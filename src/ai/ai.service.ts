import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async search(query: string) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new BadRequestException(
        'Gemini API key is not configured. Please add GEMINI_API_KEY to the backend .env file.',
      );
    }

    // 1. Fetch active properties
    const properties = await this.prisma.property.findMany({
      where: { listingStatus: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        description: true,
        address: true,
        basePrice: true,
        type: true,
        amenities: true,
      },
    });

    // 2. Fetch active events
    const events = await this.prisma.event.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        title: true,
        description: true,
        address: true,
        price: true,
        date: true,
        remainingSpots: true,
      },
    });

    // 3. Construct prompt
    const prompt = `You are the Convera AI Concierge, a virtual assistant for Convera (a premium property booking and event registration platform).

Below is the live catalog of available properties and events in our database.

Available Properties (JSON format):
${JSON.stringify(properties, null, 2)}

Available Events (JSON format):
${JSON.stringify(events, null, 2)}

User Request: "${query}"

Help the user by recommending the best matching properties and/or events. Please follow these strict guidelines:
1. Provide a warm, conversational, and helpful travel-concierge response in Markdown format.
2. Clearly explain why you are recommending these items (e.g. mention budget, amenities, locations, remaining spots).
3. Reference items by linking to them using this exact format:
   - For properties: [Title](/properties/id)
   - For events: [Title](/events/id)
4. If no exact matches are found, politely suggest the closest possible alternatives (e.g., if they ask for a hotel in Giza but none are listed, suggest an active apartment in Cairo).
5. At the absolute end of your response, output a structured JSON block containing the recommended item IDs. Format it exactly like this:
\`\`\`json
{
  "recommendedPropertyIds": ["id1", "id2"],
  "recommendedEventIds": ["id3"]
}
\`\`\`

Ensure the JSON block is the very last thing in your response.`;

    // 4. Query Gemini API using native fetch
    try {
      const model = this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }],
          }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
      }

      const responseData = (await response.json()) as any;
      const text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini API returned an empty response.');
      }

      // 5. Parse recommended IDs from JSON block
      let message = text;
      let recommendedPropertyIds: string[] = [];
      let recommendedEventIds: string[] = [];

      try {
        const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch && jsonMatch[1]) {
          const parsed = JSON.parse(jsonMatch[1]);
          recommendedPropertyIds = parsed.recommendedPropertyIds || [];
          recommendedEventIds = parsed.recommendedEventIds || [];
          // Strip the trailing JSON block from the user-facing message
          message = text.replace(jsonMatch[0], '').trim();
        }
      } catch (e) {
        // Fallback if JSON block was poorly formatted
        console.error('Failed to parse recommended IDs JSON block:', e);
      }

      // 6. Fetch full property and event objects for the recommended lists
      const recommendedProperties = recommendedPropertyIds.length > 0
        ? await this.prisma.property.findMany({
            where: { id: { in: recommendedPropertyIds }, listingStatus: 'ACTIVE' },
            include: { reviews: true, host: { select: { email: true } } },
          })
        : [];

      const recommendedEvents = recommendedEventIds.length > 0
        ? await this.prisma.event.findMany({
            where: { id: { in: recommendedEventIds }, status: 'ACTIVE' },
            include: { category: true, eligibility: true },
          })
        : [];

      return {
        message,
        properties: recommendedProperties,
        events: recommendedEvents,
      };
    } catch (error: any) {
      console.error('Gemini AI Search Error:', error);
      throw new InternalServerErrorException(
        error.message || 'An error occurred while communicating with the AI service.',
      );
    }
  }
}
