/**
 * Ví dụ policy strictScopes:
 *
 * - strictScopes=true: bắt buộc key phải có scope
 * - requireScopes: danh sách scope cần có
 *
 * Gợi ý:
 * - views: requireScopes=["VIEW_WRITE"], strictScopes=true
 * - NFT write: ["NFT_WRITE"], strictScopes=true
 * - user write: ["USER_WRITE"], strictScopes=true
 */
