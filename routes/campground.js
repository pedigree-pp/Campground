const express = require('express');
const {getCampgrounds, getCampground, createCampground, updateCampground, deleteCampground} = require('../controllers/campground');
const {protect, authorize} = require('../middleware/auth');
const router = express.Router();

router.route('/').get(getCampgrounds).post(protect, authorize('admin'), createCampground);
router.route('/:id').get(getCampground).put(protect, authorize('admin'), updateCampground).delete(protect, authorize('admin'), deleteCampground);

module.exports = router;