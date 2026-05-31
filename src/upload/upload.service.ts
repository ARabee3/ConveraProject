import { Injectable } from '@nestjs/common';
import { StorageService } from '../common/storage/storage.service';

@Injectable()
export class UploadService {
  constructor(private readonly storageService: StorageService) {}

  async uploadImage(file: Express.Multer.File): Promise<string> {
    const key = `uploads/${Date.now()}-${Math.random().toString(36).substring(7)}`;
    return this.storageService.uploadFile(file.buffer, key);
  }
}
