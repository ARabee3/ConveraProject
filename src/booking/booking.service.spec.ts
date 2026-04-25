/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/unbound-method, @typescript-eslint/no-invalid-void-type */
import { Test, TestingModule } from '@nestjs/testing';
import { BookingService } from './booking.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { BookingStatus } from '@prisma/client';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('BookingService', () => {
  let service: BookingService;
  let eventEmitter: EventEmitter2;
  let expirationQueue: { add: jest.Mock };

  const mockPrismaService = {
    property: {
      findUnique: jest.fn<Promise<unknown>, unknown[]>(),
    },
    booking: {
      findFirst: jest.fn<Promise<unknown>, unknown[]>(),
      findUnique: jest.fn<Promise<unknown>, unknown[]>(),
      create: jest.fn<Promise<unknown>, unknown[]>(),
      update: jest.fn<Promise<unknown>, unknown[]>(),
      updateMany: jest.fn<Promise<unknown>, unknown[]>(),
    },
    client: {
      booking: {
        updateMany: jest.fn<Promise<unknown>, unknown[]>(),
      },
    },
    $queryRaw: jest.fn<Promise<unknown>, unknown[]>(),
    $transaction: jest.fn((callback: (tx: unknown) => unknown) => {
      const tx = {
        booking: mockPrismaService.booking,
        $queryRaw: mockPrismaService.$queryRaw,
      };
      return callback(tx);
    }),
  };

  const mockEventEmitter = {
    emit: jest.fn<void, unknown[]>(),
  };

  const mockConfigService = {
    get: jest.fn<number, unknown[]>().mockReturnValue(15),
  };

  const mockQueue = {
    add: jest.fn<Promise<void>, unknown[]>(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: EventEmitter2, useValue: mockEventEmitter },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getQueueToken('booking-expiration'), useValue: mockQueue },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    expirationQueue = module.get(getQueueToken('booking-expiration'));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a booking with PENDING_PAYMENT status', async () => {
      const property = {
        id: 'prop-1',
        isActive: true,
        basePrice: 100,
        availabilityOverrides: [],
      };

      const booking = {
        id: 'booking-1',
        propertyId: 'prop-1',
        customerId: 'cust-1',
        startDate: new Date('2026-05-01'),
        endDate: new Date('2026-05-05'),
        totalPrice: 400,
        status: BookingStatus.PENDING_PAYMENT,
      };

      mockPrismaService.property.findUnique.mockResolvedValue(property);
      mockPrismaService.booking.findFirst.mockResolvedValue(null);
      mockPrismaService.booking.create.mockResolvedValue(booking);

      const result = await service.create('cust-1', {
        propertyId: 'prop-1',
        startDate: '2026-05-01',
        endDate: '2026-05-05',
      });

      expect(result.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(mockPrismaService.booking.create).toHaveBeenCalled();
      expect(expirationQueue.add).toHaveBeenCalledWith(
        'expire-booking',
        { bookingId: 'booking-1' },
        { delay: 15 * 60 * 1000 },
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('booking.created', expect.any(Object));
    });

    it('should throw NotFoundException if property does not exist', async () => {
      mockPrismaService.property.findUnique.mockResolvedValue(null);

      await expect(
        service.create('cust-1', {
          propertyId: 'prop-1',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException for overlapping bookings', async () => {
      const property = {
        id: 'prop-1',
        isActive: true,
        basePrice: 100,
        availabilityOverrides: [],
      };

      mockPrismaService.property.findUnique.mockResolvedValue(property);
      mockPrismaService.booking.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.create('cust-1', {
          propertyId: 'prop-1',
          startDate: '2026-05-01',
          endDate: '2026-05-05',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if endDate <= startDate', async () => {
      await expect(
        service.create('cust-1', {
          propertyId: 'prop-1',
          startDate: '2026-05-05',
          endDate: '2026-05-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirm', () => {
    it('should confirm a booking using optimistic locking', async () => {
      const booking = {
        id: 'booking-1',
        propertyId: 'prop-1',
        customerId: 'cust-1',
        status: BookingStatus.PENDING_PAYMENT,
        version: 1,
      };

      mockPrismaService.booking.findUnique.mockResolvedValueOnce(booking).mockResolvedValueOnce({
        ...booking,
        status: BookingStatus.CONFIRMED,
      });
      mockPrismaService.client.booking.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.confirm('booking-1');

      expect(result.status).toBe(BookingStatus.CONFIRMED);
      expect(mockPrismaService.client.booking.updateMany).toHaveBeenCalledWith({
        where: { id: 'booking-1', version: 1 },
        data: { status: BookingStatus.CONFIRMED },
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('booking.confirmed', expect.any(Object));
    });

    it('should throw ConflictException if optimistic lock fails', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
        version: 1,
      };

      mockPrismaService.booking.findUnique.mockResolvedValue(booking);
      mockPrismaService.client.booking.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.confirm('booking-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel a booking', async () => {
      const booking = {
        id: 'booking-1',
        status: BookingStatus.PENDING_PAYMENT,
      };

      mockPrismaService.booking.findUnique.mockResolvedValueOnce(booking).mockResolvedValueOnce({
        ...booking,
        status: BookingStatus.CANCELLED,
      });
      mockPrismaService.booking.update.mockResolvedValue({
        ...booking,
        status: BookingStatus.CANCELLED,
      });

      const result = await service.cancel('booking-1', 'Payment failed');

      expect(result.status).toBe(BookingStatus.CANCELLED);
      expect(eventEmitter.emit).toHaveBeenCalledWith('booking.cancelled', expect.any(Object));
    });
  });
});
