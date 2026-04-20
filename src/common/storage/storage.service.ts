import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_S3_REGION', 'us-east-1'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
      },
    });
    this.bucket = this.configService.get<string>('AWS_S3_BUCKET', 'convera-events');
  }

  async uploadFromUrl(imageUrl: string, key: string): Promise<string> {
    const response = await fetch(imageUrl);
    const buffer = await response.arrayBuffer();

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: Buffer.from(buffer),
        ContentType: response.headers.get('content-type') || 'image/jpeg',
      }),
    );

    return `https://${this.bucket}.s3.amazonaws.com/${key}`;
  }
}
