// Admin stub: Firestore'a bağlanmaz, hiçbir şey dinlemez.
// Admin claim gelene kadar paneli bozmaz.
export function startAdminNotifications(){
  console.log("[admin-stub] startAdminNotifications() disabled (no Firestore listen).");
}
export function startUserNotifications(){
  console.log("[admin-stub] startUserNotifications() disabled for admin context.");
}
