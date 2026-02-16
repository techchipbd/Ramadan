// Notification Manager
class NotificationManager {
    constructor() {
        this.scheduledNotifications = [];
    }
    
    async schedulePrayerNotification(prayerName, time) {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }
        
        // Use service worker for scheduling
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('prayer-notification');
        }
    }
    
    cancelAllNotifications() {
        this.scheduledNotifications.forEach(id => {
            clearTimeout(id);
        });
        this.scheduledNotifications = [];
    }
}