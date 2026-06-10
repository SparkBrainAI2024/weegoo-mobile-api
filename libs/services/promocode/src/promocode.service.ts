// promo-code.service.ts
// ─────────────────────────────────────────────────────────────
import { toMongoId } from '@libs/common';
import { CreatePromoCodeInput, IPaginatedResult, PaginationInput, PromoCodeDocument, PromoCodeStatusEnum } from '@libs/data-access';
import { UpdatePromoCodeInput } from '@libs/data-access/dtos/input/update-promo-code.input';
import { PromoCodeRepository } from '@libs/data-access/repositories/promo-code.repository';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Types } from 'mongoose';


@Injectable()
export class PromoCodeService {
   private readonly logger = new Logger(PromoCodeService.name);
  constructor(private readonly promoCodeRepository: PromoCodeRepository) {}

  // ── HELPERS ─────────────────────────────────────────────────

  private async findOrThrow(id: string): Promise<PromoCodeDocument> {
    const promoCode = await this.promoCodeRepository.findById(
      new Types.ObjectId(id),
      { path: 'occasion' },
    );
    if (!promoCode) {
      throw new NotFoundException(`Promo code with id "${id}" not found`);
    }
    return promoCode;
  }

  // Uniqueness check: ignore EXPIRED ones — same name can be reused
  private async assertNameUnique(name: string, excludeId?: string): Promise<void> {
    const filter: any = {
      name: name.toUpperCase(),
      status: { $ne: PromoCodeStatusEnum.EXPIRED },
    };
    if (excludeId) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const existing = await this.promoCodeRepository.findOne(filter);
    if (existing) {
      throw new ConflictException(
        `An active promo code with name "${name}" already exists`,
      );
    }
  }

  // ── CREATE ──────────────────────────────────────────────────
  // New promo codes start as DRAFT — must be explicitly activated
  async create(input: CreatePromoCodeInput): Promise<PromoCodeDocument> {
    await this.assertNameUnique(input.name);

    return this.promoCodeRepository.create(
      {
        ...input,
        name: input.name.toUpperCase(), // normalize for consistent uniqueness checks
        status: PromoCodeStatusEnum.DRAFT, // always start as draft
        occasion: input.occasionId
          ? new Types.ObjectId(input.occasionId)
          : undefined,
      },
      { path: 'occasion' },
    );
  }

  // ── READ ONE ────────────────────────────────────────────────
  async findById(id: string): Promise<PromoCodeDocument> {
    return this.promoCodeRepository.findById(toMongoId(id), "occasion");
  }

  // ── READ MANY ───────────────────────────────────────────────
  async findAll(
    paginationInput: PaginationInput,
  ): Promise<IPaginatedResult<PromoCodeDocument>> {
    return this.promoCodeRepository.paginate(
      paginationInput,
      { path: 'occasion' },
    );
  }

  // ── UPDATE ──────────────────────────────────────────────────
  // Rules:
  //   DRAFT    → full edit allowed
  //   ACTIVE   → only startDateTime / expiryDateTime allowed
  //   EXPIRED  → no edits allowed
  //   INACTIVE → no edits allowed (create new instead)
  async update(id: string, input: UpdatePromoCodeInput): Promise<PromoCodeDocument> {
    const promoCode = await this.findOrThrow(id);

    switch (promoCode.status) {
      case PromoCodeStatusEnum.EXPIRED:
        throw new BadRequestException(
          'Expired promo codes cannot be edited',
        );

      case PromoCodeStatusEnum.INACTIVE:
        throw new BadRequestException(
          'Inactive promo codes cannot be edited. Create a new promo code instead',
        );
case PromoCodeStatusEnum.ACTIVE: {
  this.logger.debug(`Promo code is ACTIVE — only time fields allowed, id: ${id}`, input);

  // Only time fields allowed — reject if anything else was passed
  const { startDateTime, expiryDateTime, ...rest } = input;
  const nonTimeFields = Object.keys(rest).filter(
    (k) => rest[k as keyof typeof rest] !== undefined,
  );

  if (nonTimeFields.length > 0) {
    this.logger.debug(`Non-time fields detected on ACTIVE promo code update — rejected fields: ${nonTimeFields.join(', ')}`);
    throw new BadRequestException(
      `Active promo codes only allow updating startDateTime and expiryDateTime. ` +
      `To change other fields, deactivate first and create a new promo code`,
    );
  }
  this.logger.debug('No non-time fields detected — proceeding with time update');

  // Build minimal update
  const timeUpdate: any = {};
  if (startDateTime) timeUpdate.startDateTime = startDateTime;
  if (expiryDateTime) timeUpdate.expiryDateTime = expiryDateTime;

  if (Object.keys(timeUpdate).length === 0) {
    this.logger.debug('Neither startDateTime nor expiryDateTime provided — nothing to update');
    throw new BadRequestException('No valid fields provided for update');
  }

  this.logger.debug(`Updating time fields — ${JSON.stringify(timeUpdate)}`);

  return this.promoCodeRepository.updateById(
    new Types.ObjectId(id),
    { $set: timeUpdate },
    { path: 'occasion' },
  );
}

      case PromoCodeStatusEnum.DRAFT: {
        // Full edit — check name uniqueness if name is being changed
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
  }

  // ── STATUS TRANSITIONS ───────────────────────────────────────

  // DRAFT → ACTIVE
  async activate(id: string): Promise<PromoCodeDocument> {
    const promoCode = await this.findOrThrow(id);

    if (promoCode.status !== PromoCodeStatusEnum.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT promo codes can be activated. Current status: ${promoCode.status}`,
      );
    }

    return this.promoCodeRepository.updateById(
      new Types.ObjectId(id),
      { $set: { status: PromoCodeStatusEnum.ACTIVE } },
      { path: 'occasion' },
    );
  }

  // ACTIVE → INACTIVE
  async deactivate(id: string): Promise<PromoCodeDocument> {
    const promoCode = await this.findOrThrow(id);

    if (promoCode.status !== PromoCodeStatusEnum.ACTIVE) {
      throw new BadRequestException(
        `Only ACTIVE promo codes can be deactivated. Current status: ${promoCode.status}`,
      );
    }

    return this.promoCodeRepository.updateById(
      new Types.ObjectId(id),
      { $set: { status: PromoCodeStatusEnum.INACTIVE } },
      { path: 'occasion' },
    );
  }

  // ── CRON: EXPIRE PROMO CODES ─────────────────────────────────
  // Called by PromoCodeCronService — marks all ACTIVE codes
  // where expiryDateTime has passed as EXPIRED
  async expireOutdatedPromoCodes(): Promise<void> {
    await this.promoCodeRepository.updateMany(
      {
        status: PromoCodeStatusEnum.ACTIVE,
        expiryDateTime: { $lt: new Date() },
      },
      { $set: { status: PromoCodeStatusEnum.EXPIRED } },
    );
  }

  // ── SOFT DELETE ──────────────────────────────────────────────
  // Only DRAFT promo codes can be deleted
  // ACTIVE/INACTIVE/EXPIRED are part of history — soft delete only as last resort
  async remove(id: string): Promise<boolean> {
    const promoCode = await this.findOrThrow(id);

    if (promoCode.status !== PromoCodeStatusEnum.DRAFT) {
      throw new BadRequestException(
        `Only DRAFT promo codes can be deleted. Use deactivate for ACTIVE codes`,
      );
    }

    await this.promoCodeRepository.softDeleteById(new Types.ObjectId(id));
    return true;
  }
}

