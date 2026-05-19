import mongoose from "mongoose"
import { customAlphabet } from "nanoid";

export const nanoid = customAlphabet(
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    11,
);


export const generateNanoId = (type?: string) => {
    const mongodbObjectId = generateMongoDbId()
    const mongodbStringId = ObjectIdToString(mongodbObjectId)
    return type ? `${type}_${mongodbStringId}` : mongodbStringId
}

export const generateMongoDbId = () => {
    return new mongoose.Types.ObjectId()
}
export const ObjectIdToString = (id) => {
    return new mongoose.Types.ObjectId(id).toString();
};

export const StringToObjectId = (id) => {
    return new mongoose.Types.ObjectId(id);
};
export const GenerateRandomDigit = (length: number) => {
    // In development mode, return a fixed test code '12345'
    if (process.env.NODE_ENV === 'production') {
        return Math.floor(Math.pow(10, length - 1) + Math.random() * (Math.pow(10, length) - Math.pow(10, length - 1) - 1));

    }
    return 12345;

    // In production/other modes, generate actual random digit

}