import multer from 'multer';
import cloudinary from '../config/cloudinary.js';
import streamifier from 'streamifier';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // increased to 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only jpg, jpeg, png, webp allowed'));
    }
  },
});

export const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
    cloudinary.uploader.unsigned_upload(
      base64,
      'ml_default',
      { resource_type: 'auto' },
      (error, result) => {
        if (error) {
          console.log('=== CLOUDINARY UPLOAD ERROR ===');
          console.log(JSON.stringify(error, null, 2));
          reject(error);
        } else {
          console.log('=== CLOUDINARY SUCCESS ===', result.secure_url);
          resolve(result);
        }
      }
    );
  });
};

export default upload;
