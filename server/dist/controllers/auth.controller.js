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
exports.logout = exports.refresh = exports.login = exports.register = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const RefreshToken_1 = __importDefault(require("../models/RefreshToken"));
const token_service_1 = require("../services/token.service");
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        res.status(400).json({ message: 'username, email and password are required' });
        return;
    }
    const existing = yield User_1.default.findOne({ email });
    if (existing) {
        res.status(409).json({ message: 'Email already in use' });
        return;
    }
    const user = yield User_1.default.create({ username, email, password });
    const { accessToken, refreshToken } = (0, token_service_1.generateTokens)(user.id, user.email);
    yield RefreshToken_1.default.create({
        token: refreshToken,
        userId: user._id,
        expiresAt: (0, token_service_1.getRefreshTokenExpiry)(),
    });
    res.status(201).json({ accessToken, refreshToken });
});
exports.register = register;
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: 'email and password are required' });
        return;
    }
    const user = yield User_1.default.findOne({ email });
    if (!user || !(yield user.comparePassword(password))) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }
    const { accessToken, refreshToken } = (0, token_service_1.generateTokens)(user.id, user.email);
    yield RefreshToken_1.default.create({
        token: refreshToken,
        userId: user._id,
        expiresAt: (0, token_service_1.getRefreshTokenExpiry)(),
    });
    res.json({ accessToken, refreshToken });
});
exports.login = login;
const refresh = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken is required' });
        return;
    }
    let payload;
    try {
        payload = jsonwebtoken_1.default.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    }
    catch (_a) {
        res.status(401).json({ message: 'Invalid or expired refresh token' });
        return;
    }
    const stored = yield RefreshToken_1.default.findOne({ token: refreshToken });
    if (!stored) {
        res.status(401).json({ message: 'Refresh token not recognised' });
        return;
    }
    // Rotate: delete old, issue new pair
    yield stored.deleteOne();
    const tokens = (0, token_service_1.generateTokens)(payload.userId, payload.email);
    yield RefreshToken_1.default.create({
        token: tokens.refreshToken,
        userId: stored.userId,
        expiresAt: (0, token_service_1.getRefreshTokenExpiry)(),
    });
    res.json(tokens);
});
exports.refresh = refresh;
const logout = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        res.status(400).json({ message: 'refreshToken is required' });
        return;
    }
    yield RefreshToken_1.default.deleteOne({ token: refreshToken });
    res.json({ message: 'Logged out successfully' });
});
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map