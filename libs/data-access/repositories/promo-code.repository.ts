import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseRepository } from '../base/base.repository';
import { PromoCode, PromoCodeDocument } from '../entities/promo-code.entity';
import { BaseModel } from '../base/base.model';


@Injectable()
export class PromoCodeRepository extends BaseRepository<PromoCodeDocument> {
  constructor(
    @InjectModel(PromoCode.name)
    private readonly promoCodeModel: BaseModel<PromoCodeDocument>,
  ) {
    super(promoCodeModel);
  }

  override get searchKeys(): string[] {
    return ['name'];
  }
}