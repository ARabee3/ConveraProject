import { IsString, IsDateString, IsNotEmpty } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  @IsNotEmpty()
  propertyId: string;

  @IsDateString()
  @IsNotEmpty()
  startDate: string;

  @IsDateString()
  @IsNotEmpty()
  endDate: string;
}
