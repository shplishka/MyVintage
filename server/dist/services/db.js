"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = (mongoUri) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!mongoUri) {
            throw new Error("DATABASE_URL is not defined");
        }
        yield mongoose_1.default.connect(mongoUri);
        const databaseConnection = mongoose_1.default.connection;
        databaseConnection.on("error", (error) => { throw new Error(error); });
        databaseConnection.once("open", () => console.log("Connected to Database"));
        console.log('MongoDB connected successfully');
    }
    catch (error) {
        console.error('MongoDB connection error:', error);
        throw error;
    }
});
exports.default = connectDB;
//# sourceMappingURL=db.js.map