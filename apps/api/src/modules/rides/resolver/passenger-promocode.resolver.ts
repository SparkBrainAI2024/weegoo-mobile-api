import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles, PromoCode } from '@libs/data-access';
import { PromoCodeService } from '@libs/services/promocode/src/promocode.service';
import { PromocodeListWithPaginationResponse } from '@libs/services/promocode/src/types/promocode-paginated.type';
import { PaginationInput } from '@libs/data-access/base/base.input';

@Resolver(() => PromoCode)
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.USER])
export class PassengerPromoCodeResolver {
  constructor(private readonly promoCodeService: PromoCodeService) {}

  @Query(() => PromocodeListWithPaginationResponse, {
    name: 'getActivePromoCodes',
    description: 'Get all active promo codes for the logged-in passenger. Only accessible by USER role.',
  })
  async getActivePromoCodes(
    @CurrentUser() user: User,
    @Args('input', { type: () => PaginationInput, nullable: true }) input?: PaginationInput,
  ): Promise<PromocodeListWithPaginationResponse> {
    return this.promoCodeService.getActivePromoCodes(input);
  }
}