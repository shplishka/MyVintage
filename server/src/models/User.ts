import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    profilePicture?: string;
    biography?: string;
    comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
    {
        username:       { type: String, required: true, trim: true, unique: true, minLength: 2, maxLength: 20 },
        email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
        password:       { type: String, required: true },
        profilePicture: { type: String, default: null },
        biography:      { type: String, default: null, trim: true },
    },
    { timestamps: true }
);

UserSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

UserSchema.set('toJSON', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform: (_doc: unknown, ret: any) => {
    delete ret.password;
    delete ret.refreshTokens;
    return ret;
  },
});


export default mongoose.model<IUser>('User', UserSchema);
