"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRefreshTokenExpiry = exports.generateTokens = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const generateTokens = (userId, email) => {
    const accessToken = jsonwebtoken_1.default.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
    const refreshToken = jsonwebtoken_1.default.sign({ userId, email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' });
    return { accessToken, refreshToken };
};
exports.generateTokens = generateTokens;
const getRefreshTokenExpiry = () => {
    const days = parseInt(process.env.REFRESH_TOKEN_EXPIRES_IN || '7') || 7;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    return expiry;
};
exports.getRefreshTokenExpiry = getRefreshTokenExpiry;
//# sourceMappingURL=token.service.js.map