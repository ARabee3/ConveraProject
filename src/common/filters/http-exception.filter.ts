import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let errorStr = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse() as Record<string, unknown> | string;

      if (typeof exceptionResponse === 'object' && exceptionResponse) {
        message = (exceptionResponse.message as string | string[]) || exception.message;
        errorStr = (exceptionResponse.error as string) || String(HttpStatus[status]);
      } else {
        message = exceptionResponse || exception.message;
        errorStr = String(HttpStatus[status]);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'A record with that unique field already exists.';
        errorStr = 'Conflict';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = `Database Error: ${exception.message}`;
        errorStr = 'Bad Request';
      }
    } else if (exception instanceof Error) {
      console.error(exception);
    }

    const errorResponse = {
      message: Array.isArray(message) && message.length === 1 ? message[0] : message,
      error: errorStr,
      statusCode: status,
    };

    response.status(status).json(errorResponse);
  }
}
