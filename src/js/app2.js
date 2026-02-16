// Main Application Class
class RamadanApp {
    constructor() {
        this.state = {
            location: null,
            prayerTimes: null,
            hijriDate: null,
            favorites: JSON.parse(localStorage.getItem('favoriteCities')) || [],
            settings: JSON.parse(localStorage.getItem('settings')) || {
                notifyIftar: true,
                notifySuhoor: true,
                notifyPrayer: true,
                soundIftar: true,
                soundSuhoor: true,
                autoDarkMode: true,
                showMoonPhase: true
            },
            currentMethod: 4 // Default Umm Al-Qura
        };
        
        this.init();
    }
    
    async init() {
        this.setupEventListeners();
        this.setupNavigation();
        await this.detectLocation();
        this.loadSettings();
        this.setupNotifications();
        this.startCountdowns();
        this.setupPWAPrompt();
        this.startHijriDateFlip();
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.switchSection(e.target.getAttribute('href').substring(1));
            });
        });
        
        // Settings toggles
        document.getElementById('notifyIftar').addEventListener('change', (e) => {
            this.updateSetting('notifyIftar', e.target.checked);
        });
        
        document.getElementById('notifySuhoor').addEventListener('change', (e) => {
            this.updateSetting('notifySuhoor', e.target.checked);
        });
        
        document.getElementById('soundIftar').addEventListener('change', (e) => {
            this.updateSetting('soundIftar', e.target.checked);
        });
        
        document.getElementById('soundSuhoor').addEventListener('change', (e) => {
            this.updateSetting('soundSuhoor', e.target.checked);
        });
        
        // Auto refresh every minute
        setInterval(() => this.refreshTimers(), 60000);
        
        // Check for prayer times every second
        setInterval(() => this.checkPrayerTimes(), 1000);
    }
    
    setupNavigation() {
        // Handle initial hash
        if (window.location.hash) {
            const section = window.location.hash.substring(1);
            this.switchSection(section);
        }
    }
    
    switchSection(sectionId) {
        // Update active class on sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionId).classList.add('active');
        
        // Update active class on nav links
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });
        
        // Update URL hash
        window.location.hash = sectionId;
        
        // Load section-specific content
        switch(sectionId) {
            case 'calendar':
                this.loadCalendar();
                break;
            case 'prayer':
                this.loadPrayerTimes();
                break;
        }
    }
    
    async detectLocation() {
        const locationSpan = document.getElementById('currentLocation');
        
        if (navigator.geolocation) {
            try {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        enableHighAccuracy: true,
                        timeout: 5000,
                        maximumAge: 0
                    });
                });
                
                const { latitude, longitude } = position.coords;
                
                // Reverse geocoding
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                );
                const data = await response.json();
                
                this.state.location = {
                    city: data.address.city || data.address.town || data.address.village,
                    country: data.address.country,
                    lat: latitude,
                    lng: longitude
                };
                
                locationSpan.textContent = `${this.state.location.city}, ${this.state.location.country}`;
                
                // Load prayer times for this location
                await this.loadPrayerTimes();
                
            } catch (error) {
                console.error('Location detection failed:', error);
                locationSpan.textContent = 'Location detection failed. Using default.';
                // Default to Mecca
                this.state.location = {
                    city: 'Mecca',
                    country: 'Saudi Arabia',
                    lat: 21.4225,
                    lng: 39.8262
                };
                await this.loadPrayerTimes();
            }
        } else {
            locationSpan.textContent = 'Geolocation not supported';
        }
    }
    
    async loadPrayerTimes() {
        if (!this.state.location) return;
        
        try {
            const date = new Date();
            const response = await fetch(
                `https://api.aladhan.com/v1/timings/${date.getTime() / 1000}?latitude=${this.state.location.lat}&longitude=${this.state.location.lng}&method=${this.state.currentMethod}`
            );
            
            const data = await response.json();
            this.state.prayerTimes = data.data.timings;
            this.state.hijriDate = data.data.date.hijri;
            
            this.renderPrayerTimes();
            this.updateHijriDate();
            this.checkRamadan();
            
        } catch (error) {
            console.error('Failed to load prayer times:', error);
        }
    }
    
    renderPrayerTimes() {
        if (!this.state.prayerTimes) return;
        
        const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const container = document.getElementById('prayerCards');
        
        container.innerHTML = prayers.map(prayer => `
            <div class="prayer-card glass" id="prayer-${prayer}">
                <div class="prayer-name">${prayer}</div>
                <div class="prayer-time">${this.formatTime(this.state.prayerTimes[prayer])}</div>
            </div>
        `).join('');
        
        // Update mini prayer times
        this.updatePrayerTimeline();
    }
    
    formatTime(time) {
        // Convert 24h to 12h format
        const [hours, minutes] = time.split(':');
        const date = new Date();
        date.setHours(hours, minutes);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
        });
    }
    
    updatePrayerTimeline() {
        if (!this.state.prayerTimes) return;
        
        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        
        const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        let nextPrayer = null;
        let nextPrayerTime = null;
        
        for (let prayer of prayers) {
            const [hours, minutes] = this.state.prayerTimes[prayer].split(':');
            const prayerTime = parseInt(hours) * 60 + parseInt(minutes);
            
            if (prayerTime > currentTime) {
                nextPrayer = prayer;
                nextPrayerTime = prayerTime;
                break;
            }
        }
        
        // Calculate progress
        if (nextPrayer && nextPrayerTime) {
            const prevPrayer = prayers[prayers.indexOf(nextPrayer) - 1] || prayers[prayers.length - 1];
            const [prevHours, prevMinutes] = this.state.prayerTimes[prevPrayer].split(':');
            const prevTime = parseInt(prevHours) * 60 + parseInt(prevMinutes);
            
            const total = nextPrayerTime - prevTime;
            const elapsed = currentTime - prevTime;
            const progress = (elapsed / total) * 100;
            
            document.getElementById('prayerProgress').style.width = `${Math.min(100, Math.max(0, progress))}%`;
        }
        
        // Highlight current prayer
        prayers.forEach(prayer => {
            const element = document.getElementById(`prayer-${prayer}`);
            if (element) {
                element.classList.remove('current');
            }
        });
        
        if (nextPrayer) {
            const nextElement = document.getElementById(`prayer-${nextPrayer}`);
            if (nextElement) {
                nextElement.classList.add('current');
            }
        }
    }
    
    startCountdowns() {
        setInterval(() => {
            if (!this.state.prayerTimes) return;
            
            const now = new Date();
            const maghrib = this.state.prayerTimes.Maghrib.split(':');
            const fajr = this.state.prayerTimes.Fajr.split(':');
            
            // Calculate next Iftar (Maghrib)
            const iftarTime = new Date();
            iftarTime.setHours(parseInt(maghrib[0]), parseInt(maghrib[1]), 0);
            
            if (now > iftarTime) {
                iftarTime.setDate(iftarTime.getDate() + 1);
            }
            
            const iftarDiff = iftarTime - now;
            const iftarHours = Math.floor(iftarDiff / (1000 * 60 * 60));
            const iftarMinutes = Math.floor((iftarDiff % (1000 * 60 * 60)) / (1000 * 60));
            const iftarSeconds = Math.floor((iftarDiff % (1000 * 60)) / 1000);
            
            document.getElementById('iftarTimer').textContent = 
                `${String(iftarHours).padStart(2, '0')}:${String(iftarMinutes).padStart(2, '0')}:${String(iftarSeconds).padStart(2, '0')}`;
            
            // Calculate next Suhoor (Fajr)
            const suhoorTime = new Date();
            suhoorTime.setHours(parseInt(fajr[0]), parseInt(fajr[1]), 0);
            
            if (now > suhoorTime) {
                suhoorTime.setDate(suhoorTime.getDate() + 1);
            }
            
            const suhoorDiff = suhoorTime - now;
            const suhoorHours = Math.floor(suhoorDiff / (1000 * 60 * 60));
            const suhoorMinutes = Math.floor((suhoorDiff % (1000 * 60 * 60)) / (1000 * 60));
            const suhoorSeconds = Math.floor((suhoorDiff % (1000 * 60)) / 1000);
            
            document.getElementById('suhoorTimer').textContent = 
                `${String(suhoorHours).padStart(2, '0')}:${String(suhoorMinutes).padStart(2, '0')}:${String(suhoorSeconds).padStart(2, '0')}`;
                
        }, 1000);
    }
    
    checkPrayerTimes() {
        if (!this.state.prayerTimes) return;
        
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        // Check for Maghrib (Iftar)
        if (currentTime === this.state.prayerTimes.Maghrib && this.state.settings.soundIftar) {
            this.playSound('iftar');
            if (this.state.settings.notifyIftar) {
                this.sendNotification('Iftar Time', 'Time to break your fast');
            }
        }
        
        // Check for Fajr (Suhoor ends)
        if (currentTime === this.state.prayerTimes.Fajr && this.state.settings.soundSuhoor) {
            this.playSound('suhoor');
            if (this.state.settings.notifySuhoor) {
                this.sendNotification('Suhoor Ends', 'Time to stop eating');
            }
        }
        
        // Update prayer timeline
        this.updatePrayerTimeline();
    }
    
    playSound(type) {
        const audio = document.getElementById(`${type}Sound`);
        const soundSelect = document.getElementById('soundSelect');
        
        // Set sound file based on selection
        const sounds = {
            adhan1: 'path/to/adhan1.mp3',
            adhan2: 'path/to/adhan2.mp3',
            notification: 'path/to/notification.mp3'
        };
        
        audio.src = sounds[soundSelect.value];
        audio.play().catch(e => console.log('Audio play failed:', e));
    }
    
    sendNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: body,
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                vibrate: [200, 100, 200]
            });
        }
    }
    
    setupNotifications() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }
    
    updateHijriDate() {
        if (!this.state.hijriDate) return;
        
        const day = String(this.state.hijriDate.day).padStart(2, '0');
        const month = String(this.state.hijriDate.month.number).padStart(2, '0');
        const year = this.state.hijriDate.year;
        
        document.getElementById('hijriDay').textContent = day;
        document.getElementById('hijriMonth').textContent = month;
        document.getElementById('hijriYear').textContent = year;
        
        // Add flip animation
        document.querySelectorAll('.flip-number').forEach(el => {
            el.style.animation = 'none';
            el.offsetHeight; // Trigger reflow
            el.style.animation = 'flip 1s ease-in-out';
        });
    }
    
    startHijriDateFlip() {
        // Update Hijri date every minute (in case of day change)
        setInterval(() => {
            this.loadPrayerTimes();
        }, 60000);
    }
    
    checkRamadan() {
        // Check if current month is Ramadan (month 9)
        if (this.state.hijriDate && this.state.hijriDate.month.number === 9) {
            document.body.classList.add('ramadan-mode');
        }
    }
    
    loadCalendar() {
        if (!this.state.hijriDate) return;
        
        const grid = document.getElementById('calendarGrid');
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        let html = '';
        
        // Add day names
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            html += `<div class="calendar-day header">${day}</div>`;
        });
        
        // Add empty cells for days before month start
        for (let i = 0; i < firstDay.getDay(); i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // Add days of month
        for (let d = 1; d <= lastDay.getDate(); d++) {
            const date = new Date(today.getFullYear(), today.getMonth(), d);
            const isToday = d === today.getDate();
            const dayClass = isToday ? 'calendar-day today' : 'calendar-day';
            
            html += `
                <div class="${dayClass}">
                    <div class="day-number">${d}</div>
                    <div class="day-ramadan">Ramadan ${d}</div>
                </div>
            `;
        }
        
        grid.innerHTML = html;
    }
    
    updateCalculationMethod() {
        const method = document.getElementById('calcMethod').value;
        this.state.currentMethod = parseInt(method);
        this.loadPrayerTimes();
    }
    
    updateSetting(key, value) {
        this.state.settings[key] = value;
        localStorage.setItem('settings', JSON.stringify(this.state.settings));
    }
    
    loadSettings() {
        // Apply settings to UI
        document.getElementById('notifyIftar').checked = this.state.settings.notifyIftar;
        document.getElementById('notifySuhoor').checked = this.state.settings.notifySuhoor;
        document.getElementById('notifyPrayer').checked = this.state.settings.notifyPrayer;
        document.getElementById('soundIftar').checked = this.state.settings.soundIftar;
        document.getElementById('soundSuhoor').checked = this.state.settings.soundSuhoor;
        document.getElementById('autoDarkMode').checked = this.state.settings.autoDarkMode;
        document.getElementById('showMoonPhase').checked = this.state.settings.showMoonPhase;
    }
    
    setupPWAPrompt() {
        let deferredPrompt;
        const installBtn = document.getElementById('installPWA');
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            installBtn.style.display = 'flex';
        });
        
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;
            
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            
            if (outcome === 'accepted') {
                console.log('PWA installed');
            }
            
            deferredPrompt = null;
            installBtn.style.display = 'none';
        });
    }
    
    refreshTimers() {
        this.loadPrayerTimes();
    }
    
    searchCity(event) {
        if (event.key === 'Enter') {
            const query = event.target.value;
            this.geocodeCity(query);
        }
    }
    
    async geocodeCity(query) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
            );
            const data = await response.json();
            
            if (data.length > 0) {
                this.state.location = {
                    city: data[0].display_name.split(',')[0],
                    lat: parseFloat(data[0].lat),
                    lng: parseFloat(data[0].lon)
                };
                
                document.getElementById('currentLocation').textContent = data[0].display_name.split(',')[0];
                await this.loadPrayerTimes();
            }
        } catch (error) {
            console.error('Geocoding failed:', error);
        }
    }
    
    addFavoriteCity() {
        if (this.state.location && !this.state.favorites.some(f => f.city === this.state.location.city)) {
            this.state.favorites.push(this.state.location);
            localStorage.setItem('favoriteCities', JSON.stringify(this.state.favorites));
            this.renderFavoriteCities();
        }
    }
    
    renderFavoriteCities() {
        const container = document.getElementById('favoriteCities');
        container.innerHTML = this.state.favorites.map(city => `
            <div class="favorite-city" onclick="app.selectCity('${city.city}', ${city.lat}, ${city.lng})">
                <i class="fas fa-city"></i> ${city.city}
            </div>
        `).join('');
    }
    
    selectCity(city, lat, lng) {
        this.state.location = { city, lat, lng };
        document.getElementById('currentLocation').textContent = city;
        this.loadPrayerTimes();
    }
    
    clearFavorites() {
        this.state.favorites = [];
        localStorage.removeItem('favoriteCities');
        this.renderFavoriteCities();
    }
    
    exportPDF() {
        // Use jsPDF or similar library to export calendar
        alert('PDF export functionality would be implemented here');
    }
    
    testSound() {
        this.playSound('iftar');
    }
}

// Initialize app
const app = new RamadanApp();
window.app = app; // Make available globally for inline event handlers