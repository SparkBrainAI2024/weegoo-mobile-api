export const RIDES = {
  RIDE_NOT_FOUND: "राइड फेला परेन",
  INVALID_RIDE_ID: "अवैध राइड आईडी",
  CANCEL_ALREADY_COMPLETED:
    "यो राइड पहिले नै पूरा भइसकेको छ र रद्द गर्न मिल्दैन।",

  CANCEL_IN_PROGRESS: "यो राइड हाल सञ्चालनमा छ र रद्द गर्न मिल्दैन।",

  CANCEL_PENDING: "यो राइड अझै पेंडिङ अवस्थामा छ र रद्द गर्न मिल्दैन।",

  CANCEL_UNAUTHORIZED: "तपाईंलाई यो राइड रद्द गर्ने अनुमति छैन।",

  CANCEL_SHOULD_STRING: "रद्द गर्ने उप-श्रेणीको लेबल स्ट्रिङ हुनुपर्छ।",

  CANCEL_SHOULDNOT_EMPTY: "रद्द गर्ने उप-श्रेणीको लेबल खाली हुनु हुँदैन।",
  CANCEL_REASON_REQUIRED_FOR_OTHER:
    "जब रद्द गर्ने श्रेणी OTHER हो भने रद्द करने कारण सामग्री आवश्यक छ",
  INVALID_CANCEL_SUB_CATEGORY:
    "चयनित रद्द करने उप-श्रेणी आपके भूमिका के लिए मान्य नहीं है",
  CANCEL_ALREADY_CANCELLED:
    "यो राइड पहिले नै रद्द गरिसकेको छ र फेरि रद्द गर्न मिल्दैन।",
  UPDATE_RIDE_NOT_FOUND:
    "अगामी पुष्टि भएको राइड फेला परेन। केवल अगामी पुष्टि भएका राइडहरू अपडेट गर्न सकिन्छ।",
  UPDATE_RIDE_FAILED: "राइड अपडेट गर्न असफल। कृपया फेरि प्रयास गर्नुहोस्।",
  UPDATE_RIDE_SUCCESS: "राइड सफलतापूर्वक अपडेट भयो।",
  PROMO_CODE_NOT_FOUND: "प्रोमो कोड फेला परेन",
  PROMO_EXPIRED: "यो प्रोमो कोडको म्याद समाप्त भएको छ",
  PROMO_NOT_STARTED: "यो प्रोमो कोड अझै सुरु भएको छैन",
  PROMO_INACTIVE: "यो प्रोमो कोड हाल निष्क्रिय छ",
  PROMO_LIMIT_REACHED: "तपाईंले यस प्रोमो कोडको प्रयोग सीमा पुर्‍याउनुभएको छ",
  PROMO_TOTAL_LIMIT_REACHED: "यस प्रोमो कोडको कुल प्रयोग सीमा पुगेको छ",
  MIN_FARE_NOT_MET: "यस प्रोमो कोडको लागि न्यूनतम भाडा आवश्यकता पुगेको छैन",
  PROMO_APPLIED: "प्रोमो कोड सफलतापूर्वक लागू गरियो",
  PROMO_REMOVED: "प्रोमो कोड सफलतापूर्वक हटाइयो",
  INVALID_BOOKING_TIME: "बुकिङ समय विगतमा हुन सक्दैन।",
  BOOKING_TIME_LIMIT_EXCEEDED: "राइडहरू २४ घण्टा अगाडि मात्र बुक गर्न सकिन्छ।",
  RIDE_OVERLAP: "तपाईंको यस समयको आसपास अर्को राइड पहिले नै तय गरिएको छ।",
  PROMO_NOT_APPLICABLE_FOR_STATUS:
    "प्रोमो कोडहरू पुष्टि भएका राइडहरूमा मात्र लागू गर्न सकिन्छ।",
  PROMO_NOT_APPLICABLE_FOR_RIDE_TYPE:
    "यो प्रोमो कोड यो राइड प्रकारको लागि लागू हुँदैन।",
  INVALID_STATUS: "यो अपरेशनको लागि अवैध राइड स्थिति",
  NOT_ASSOCIATED_WITH_DRIVER: "यो राइड तपाईंको मा नभएको छ",
};
