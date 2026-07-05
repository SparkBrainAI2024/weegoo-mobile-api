import { toMongoId } from "@libs/common";
import { getActiveProfileImageUrl } from "@libs/common/utils/entity.utils";
import { Driver } from "@libs/data-access/dtos/response/driver-w-documents.response";
import { DriverDocumentRepository } from "@libs/data-access/repositories/driver-document.repository";
import { UserDetailsRepository } from "@libs/data-access/repositories/user-detail.repository";
import { UserRepository } from "@libs/data-access/repositories/user.repository";
import { S3Service } from "@libs/s3";
import { Injectable, NotFoundException } from "@nestjs/common";

@Injectable()
export class DriverService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly driverDocumentRepository: DriverDocumentRepository,
    private readonly s3: S3Service,
  ) {}

  async getDriverDetails(driverId: string): Promise<Driver> {
    const userDoc = await this.userRepository.findById(toMongoId(driverId));
    if (!userDoc) {
      throw new NotFoundException("Driver not found");
    }

    const details = await this.userDetailsRepository.findOne(
      { userId: toMongoId(driverId) },
      null,
      {
        fullName: 1,
        profileImages: 1,
        rating: 1,
        locationChannelId: 1,
        geoLocation: 1,
      },
    );

    const documents =
      await this.driverDocumentRepository.getDriverDocuments(driverId);

    return {
      id: driverId,
      fullName: details?.fullName || userDoc.fullName || "Driver",
      profileImage: getActiveProfileImageUrl(details?.profileImages, (key) =>
        this.s3.getPublicUrl(key),
      ),
      rating: details?.rating ?? 0,
      phone: userDoc.phone || "",
      locationChannelId: details?.locationChannelId ?? null,
      documents: documents ?? [],
    };
  }
}
