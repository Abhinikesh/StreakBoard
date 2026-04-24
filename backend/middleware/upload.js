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
    console.log('=== CLOUDINARY CONFIG CHECK ===');
    console.log('cloud_name:', cloudinary.config().cloud_name);
    console.log('api_key:', cloudinary.config().api_key);
    console.log('api_secret exists:', !!cloudinary.config().api_secret);

    const stream = cloudinary.uploader.upload_stream(
      { folder: 'avatars' },
      (error, result) => {
        if (error) {
          console.log('=== CLOUDINARY UPLOAD ERROR ===');
          console.log(JSON.stringify(error, null, 2));
          reject(error);
        } else {
          resolve(result);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export default upload;
