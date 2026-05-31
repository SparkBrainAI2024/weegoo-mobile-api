import { HttpException, HttpStatus } from '@nestjs/common';
import * as Jwt from 'jsonwebtoken';

export const generateToken = async (payload, secretKey, options): Promise<string> => {
    return new Promise((resolve, reject) => {
        Jwt.sign(payload, secretKey, options, function (error, token) {
            if (error) {
                reject(error);
            }
            resolve(token);
        });
    });
};
export const verifyToken = async (token, secretKey) => {
    try {
        return Jwt.verify(token, secretKey);

    } catch (e) {
    console.log('verifyToken error:', e); // ← add this

        return false
    }
};

