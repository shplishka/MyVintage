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
exports.deleteUser = exports.updateUser = exports.getUserById = exports.getAllUsers = void 0;
const User_1 = __importDefault(require("../models/User"));
const getAllUsers = (_req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const users = yield User_1.default.find().select('-password');
    res.json(users);
});
exports.getAllUsers = getAllUsers;
const getUserById = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const user = yield User_1.default.findById(req.params.id).select('-password');
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.json(user);
});
exports.getUserById = getUserById;
const updateUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (req.params.id !== ((_a = req.jwtUser) === null || _a === void 0 ? void 0 : _a.userId)) {
        res.status(403).json({ message: 'Forbidden: you can only update your own profile' });
        return;
    }
    const user = yield User_1.default.findById(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    const allowed = ['username', 'profilePicture', 'biography'];
    allowed.forEach((field) => {
        if (req.body[field] !== undefined) {
            user[field] = req.body[field];
        }
    });
    yield user.save();
    res.json(user);
});
exports.updateUser = updateUser;
const deleteUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    if (req.params.id !== ((_a = req.jwtUser) === null || _a === void 0 ? void 0 : _a.userId)) {
        res.status(403).json({ message: 'Forbidden: you can only delete your own account' });
        return;
    }
    const user = yield User_1.default.findByIdAndDelete(req.params.id);
    if (!user) {
        res.status(404).json({ message: 'User not found' });
        return;
    }
    res.json({ message: 'Account deleted successfully' });
});
exports.deleteUser = deleteUser;
//# sourceMappingURL=user.controller.js.map