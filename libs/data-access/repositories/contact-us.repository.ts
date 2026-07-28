import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { ErrorException } from '@libs/common';
import {
  ContactUsDocument,
  ContactUs,
} from '../entities/contact-us.entity';

@Injectable()
export class ContactUsRepository extends BaseRepository<ContactUsDocument> {
  constructor(
    @InjectModel(ContactUs.name)
    private readonly _model: BaseModel<ContactUsDocument>,
  ) {
    super(_model);
  }

  async createContactUs(
    contactUsData: Partial<ContactUsDocument>,
  ): Promise<ContactUsDocument> {
    try {
      const contactUs = this._model.create(contactUsData);
      return contactUs;
    } catch (e) {
      ErrorException(
        e,
        'COMMON.INTERNAL_SERVER_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}