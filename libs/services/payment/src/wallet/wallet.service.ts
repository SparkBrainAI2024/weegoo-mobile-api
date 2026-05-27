import { TransactionRepository } from '@libs/data-access';
import { WalletRepository } from '@libs/data-access/repositories/wallet.repository';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';



@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly transactionRepo: TransactionRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}


}