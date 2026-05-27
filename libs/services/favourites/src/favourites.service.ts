import { PaginationInput, RidesRepository, User, RidesDocument, RideStatus, RideTypes, ProvinceEnum, PaginationInputOnly } from '@libs/data-access';
import { Types } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { FavouritesRepository } from '@libs/data-access/repositories/favourites.repository';
import { FavouritesDocument } from '@libs/data-access/entities/favourites.entity';

@Injectable()
export class FavouriteService {
    constructor(
        private readonly favouriteRepository: FavouritesRepository,
    ) { }

    /**
      * Retrieves a paginated list of favourite rides for a given user. The method accepts the user object and pagination options, and returns a paginated response containing the user's favourite rides. The pagination options can include page number, limit, sorting, and filtering criteria to customize the results.
      * @param user - The user for whom to retrieve favourite rides
      * @param options - Pagination and filtering options
      * @returns A paginated list of the user's favourite rides
     */
    async findRides(
        user: User,
        options: PaginationInputOnly,
    ) {
        return this.favouriteRepository.findByPassengerIdWithPagination(user._id.toString(), options);
    }

    /**
     creates a new favourite entry for a user. The favouriteData should include necessary details such as passengerId, rideId, and any other relevant information. The method returns the created FavouritesDocument.
     * @param favouriteData - Partial data for creating a favourite entry
     * @returns The created FavouritesDocument
     */
    async createFavorite(rideData: Partial<FavouritesDocument>): Promise<FavouritesDocument> {
        return this.favouriteRepository.createFavourite(rideData);
    }

    /** get rides by favourite id and passenger Id */

    async getFavouriteById(favouriteId: string, passengerId: string): Promise<FavouritesDocument | null> {
        return this.favouriteRepository.findOne({ _id: new Types.ObjectId(favouriteId), passengerId: new Types.ObjectId(passengerId) });
    }


}
