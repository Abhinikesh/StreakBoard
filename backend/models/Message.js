import mongoose from 'mongoose';
const { Schema } = mongoose;

const messageSchema = new Schema({
  senderId:   { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  receiverId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  content:    { type: String, required: true, trim: true, maxlength: 280 },
  readAt:     { type: Date, default: null },
}, { timestamps: true });

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, readAt: 1 });

export default mongoose.model('Message', messageSchema);
