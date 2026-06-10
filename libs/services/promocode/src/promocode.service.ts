// promo-code.service.ts
// ─────────────────────────────────────────────────────────────
import { ErrorException, toMongoId } from '@libs/common';
import { CreatePromoCodeInput, IPaginatedResult, PaginationInput, PromoCodeDocument, PromoCodeStatusEnum } from '@libs/data-access';
import { PromoCodeFindAllInput } from '@libs/data-access/dtos/input/promocode-filter.input';
import { UpdatePromoCodeInput } from '@libs/data-access/dtos/input/update-promo-code.input';
import { PromoCodeRepository } from '@libs/data-access/repositories/promo-code.repository';
import { PROMO_CODE } from '@libs/localization/en/promocode.messages';
import {
  Injectable,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { FilterQuery, Types } from 'mongoose';



@Injectable()
export class PromoCodeService {
  private readonly logger = new Logger(PromoCodeService.name);

  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

  // ── HELPERS ─────────────────────────────────────────────────

  private async findOrThrow(id: string): Promise<PromoCodeDocument> {
    try {
      const promoCode = await this.promoCodeRepository.findById(
        new Types.ObjectId(id),
        { path: 'occasion' },
      );
      if (!promoCode) {
        ErrorException(null, 'PROMO_CODE.NOT_FOUND', HttpStatus.NOT_FOUND);
      }
      return promoCode;
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }

  private async assertNameUnique(name: string, excludeId?: string): Promise<void> {
    try {
      const filter: any = {
        name: name.toUpperCase(),
        status: { $ne: PromoCodeStatusEnum.EXPIRED },
      };
      if (excludeId) {
        filter._id = { $ne: new Types.ObjectId(excludeId) };
      }
      const existing = await this.promoCodeRepository.findOne(filter);
      if (existing) {
        ErrorException(null, 'PROMO_CODE.NAME_ALREADY_EXISTS', HttpStatus.CONFLICT);
      }
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.NAME_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }
  }

  // ── CREATE ──────────────────────────────────────────────────
  async create(input: CreatePromoCodeInput): Promise<PromoCodeDocument> {
    try {
      await this.assertNameUnique(input.name);
      return this.promoCodeRepository.create(
        {
          ...input,
          name: input.name.toUpperCase(),
          status: PromoCodeStatusEnum.DRAFT,
          occasion: input.occasionId
            ? new Types.ObjectId(input.occasionId)
            : undefined,
        },
        { path: 'occasion' },
      );
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.CREATE', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── READ ONE ────────────────────────────────────────────────
  async findById(id: string): Promise<PromoCodeDocument> {
    try {
      return this.promoCodeRepository.findById(toMongoId(id), 'occasion');
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.NOT_FOUND', HttpStatus.NOT_FOUND);
    }
  }

  // ── READ MANY ───────────────────────────────────────────────
  async findAll(
    input: PromoCodeFindAllInput,
  ): Promise<IPaginatedResult<PromoCodeDocument>> {
    try {
      const filter: FilterQuery<PromoCodeDocument> = {};

      if (input.filter?.status) filter.status = input.filter.status;
      if (input.filter?.appliedTo) filter.appliedTo = input.filter.appliedTo;
      if (input.filter?.occasion) {
        const occasionId = input.filter.occasion.toString();
        if (Types.ObjectId.isValid(occasionId)) {
          filter.occasion = toMongoId(occasionId);
        }
      }

      const { filter: _, ...paginationOnly } = input;

      return this.promoCodeRepository.paginate(
        paginationOnly as PromoCodeFindAllInput,
        { path: 'occasion' },
        filter,
      );
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.FIND_ALL', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── UPDATE ──────────────────────────────────────────────────
  async update(id: string, input: UpdatePromoCodeInput): Promise<PromoCodeDocument> {
    try {
      const promoCode = await this.findOrThrow(id);

      switch (promoCode.status) {
        case PromoCodeStatusEnum.EXPIRED:
          ErrorException(null, 'PROMO_CODE.EXPIRED_NO_EDIT', HttpStatus.BAD_REQUEST);
          break;

        case PromoCodeStatusEnum.INACTIVE:
          ErrorException(null, 'PROMO_CODE.INACTIVE_NO_EDIT', HttpStatus.BAD_REQUEST);
          break;

        case PromoCodeStatusEnum.ACTIVE: {
          const { startDateTime, expiryDateTime, ...rest } = input;
          const nonTimeFields = Object.keys(rest).filter(
            (k) => rest[k as keyof typeof rest] !== undefined,
          );

          if (nonTimeFields.length > 0) {
            ErrorException(null, 'PROMO_CODE.ACTIVE_LIMITED_EDIT', HttpStatus.BAD_REQUEST);
          }

          const timeUpdate: any = {};
          if (startDateTime) timeUpdate.startDateTime = startDateTime;
          if (expiryDateTime) timeUpdate.expiryDateTime = expiryDateTime;

          if (Object.keys(timeUpdate).length === 0) {
            ErrorException(null, 'PROMO_CODE.NO_VALID_FIELDS', HttpStatus.BAD_REQUEST);
          }

          return this.promoCodeRepository.updateById(
            new Types.ObjectId(id),
            { $set: timeUpdate },
            { path: 'occasion' },
          );
        }

        case PromoCodeStatusEnum.DRAFT: {
          if (input.name && input.name.toUpperCase() !== promoCode.name) {
            await this.assertNameUnique(input.name, id);
          }

          const updatePayload: any = {
            ...input,
            ...(input.name && { name: input.name.toUpperCase() }),
            ...(input.occasionId && {
              occasion: new Types.ObjectId(input.occasionId),
            }),
          };
          delete updatePayload.occasionId;

          return this.promoCodeRepository.updateById(
            new Types.ObjectId(id),
            { $set: updatePayload },
            { path: 'occasion' },
          );
        }
      }
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.UPDATE', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── STATUS TRANSITIONS ───────────────────────────────────────
  async activate(id: string): Promise<PromoCodeDocument> {
    try {
      const promoCode = await this.findOrThrow(id);
      if (promoCode.status !== PromoCodeStatusEnum.DRAFT) {
        ErrorException(null, 'PROMO_CODE.ACTIVATE_ONLY_DRAFT', HttpStatus.BAD_REQUEST);
      }
      return this.promoCodeRepository.updateById(
        new Types.ObjectId(id),
        { $set: { status: PromoCodeStatusEnum.ACTIVE } },
        { path: 'occasion' },
      );
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.ACTIVATE', HttpStatus.BAD_REQUEST);
    }
  }

  async deactivate(id: string): Promise<PromoCodeDocument> {
    try {
      const promoCode = await this.findOrThrow(id);
      if (promoCode.status !== PromoCodeStatusEnum.ACTIVE) {
        ErrorException(null, 'PROMO_CODE.DEACTIVATE_ONLY_ACTIVE', HttpStatus.BAD_REQUEST);
      }
      return this.promoCodeRepository.updateById(
        new Types.ObjectId(id),
        { $set: { status: PromoCodeStatusEnum.INACTIVE } },
        { path: 'occasion' },
      );
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.DEACTIVATE', HttpStatus.BAD_REQUEST);
    }
  }

  // ── CRON ─────────────────────────────────────────────────────
  async expireOutdatedPromoCodes(): Promise<void> {
    try {
      await this.promoCodeRepository.updateMany(
        {
          status: PromoCodeStatusEnum.ACTIVE,
          expiryDateTime: { $lt: new Date() },
        },
        { $set: { status: PromoCodeStatusEnum.EXPIRED } },
      );
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.EXPIRE_CRON', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

   async remove(id: string): Promise<boolean> {
    try {
      const promoCode = await this.findOrThrow(id);
      if (promoCode.status !== PromoCodeStatusEnum.DRAFT) {
        ErrorException(null, 'PROMO_CODE.DELETE_ONLY_DRAFT', HttpStatus.BAD_REQUEST)
      }
      await this.promoCodeRepository.softDeleteById(new Types.ObjectId(id));
      return true;
    } catch (e) {
      ErrorException(e, 'PROMO_CODE.DELETE', HttpStatus.BAD_REQUEST);
    }
  }

}