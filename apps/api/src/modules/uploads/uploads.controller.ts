import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads');
const ALLOWED = /^(image\/(jpeg|png|webp)|audio\/(aac|mp4|m4a|mpeg|ogg|webm|x-m4a)|application\/pdf)$/;

/**
 * Envoi de fichiers : photos produits et boutiques (WebP < 80 Ko conseillé), photo du portail,
 * note vocale (30 s), pièces d'identité. Stockage local au MVP ; à remplacer par un stockage objet
 * (S3, OVH Object Storage) en production, sans changer les applications.
 */
@ApiTags('Fichiers')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Post()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => cb(null, ALLOWED.test(file.mimetype)),
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(UPLOAD_DIR, { recursive: true });
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase().slice(0, 6)}`),
      }),
    }),
  )
  upload(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier manquant ou format non accepté (photo, audio ou PDF, 2 Mo max)');
    return { url: `/uploads/${file.filename}`, size: file.size, mimeType: file.mimetype };
  }
}
