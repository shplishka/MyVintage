import multer from 'multer';

const storage = multer.diskStorage ({
 destination : function (req, file, cb) {
 cb(null, 'public/')
 },
 filename: function (req, file, cb) {
 const ext = file.originalname .split('.')
 . filter(Boolean) // removes empty extensions (e.g. `filename...txt`)
 . slice(1)
 . join('.')
 cb(null, req.params.id + "." + ext)
 }
})
const upload = multer({ storage: storage });


export default upload;
