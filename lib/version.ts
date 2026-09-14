/**
 * Thông tin phiên bản dùng chung cho giao diện, PowerPoint và metadata.
 *
 * Tệp này do THẦY DŨNG tự thêm ở bản V12.2 và đã nối vào bốn chỗ: tiêu đề
 * trang, dòng dưới tiêu đề, chân slide PowerPoint và câu mở đầu prompt gửi AI.
 * Cách làm ấy tốt hơn bản tôi định gửi (tôi chỉ nối vào một chỗ), nên V12.3
 * GIỮ NGUYÊN tên hàm và cách nối của thầy, chỉ lên số phiên bản.
 *
 * tests.mjs đối chiếu APP_VERSION với "version" trong package.json, nên hai
 * chỗ không thể lệch nhau âm thầm.
 */
export const APP_NAME = "LessonStudio";
export const APP_VERSION = "12.10";
export const APP_LABEL = `${APP_NAME} V${APP_VERSION}`;
