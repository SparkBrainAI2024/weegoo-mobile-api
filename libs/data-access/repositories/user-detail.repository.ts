import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { BaseModel } from '../base/base.model';
import { BaseRepository } from '../base/base.repository';
import { UserDetails, UserDetailsDocument } from '../entities/user-details.entity';

@Injectable()
export class UserDetailsRepository extends BaseRepository<UserDetailsDocument> {
    constructor(@InjectModel(UserDetails.name) private readonly _model: BaseModel<UserDetailsDocument>) {
        super(_model);
    }
    findByEmail(email: string) {
        return this.model.findOne({ email });
    }

}
