import { Resolver, Mutation, Args } from "@nestjs/graphql";
import { AuthService } from "@libs/services/auth";
import { EmailSignInInput,SignInResponse } from "@libs/data-access";

@Resolver()
export class AuthResolver{

constructor(private readonly authService: AuthService) {}

//  @Mutation(() => SignInResponse)
//   async signIn(@Args("input") input: EmailSignInInput) {
//         return this.authService.signIn(input);
//   }
}