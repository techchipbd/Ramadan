// Ramadan Companion App
class RamadanApp {
    constructor() {
        this.state = {
            location: null,
            prayerTimes: null,
            hijriDate: null,
            favorites: JSON.parse(localStorage.getItem('favoriteCities')) || [],
            settings: JSON.parse(localStorage.getItem('settings')) || {
                notifyIftar: true,
                notifySuhoor: true
            },
            currentMethod: 4
        };
        
        this.init();
    }
    
    async init() {
        console.log('Ramadan App Initialized');
        this.setupEventListeners();
        await this.detectLocation();
        this.startCountdowns();
        this.renderFavoriteCities();
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.closest('a').getAttribute('href').substring(1);
                this.switchSection(section);
            });
        });
        
        // Settings toggles
        const notifyIftar = document.getElementById('notifyIftar');
        if (notifyIftar) {
            notifyIftar.addEventListener('change', (e) => {
                this.updateSetting('notifyIftar', e.target.checked);
            });
        }
        
        const notifySuhoor = document.getElementById('notifySuhoor');
        if (notifySuhoor) {
            notifySuhoor.addEventListener('change', (e) => {
                this.updateSetting('notifySuhoor', e.target.checked);
            });
        }
    }
    
    switchSection(sectionId) {
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        document.querySelectorAll('.nav-links a').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${sectionId}`) {
                link.classList.add('active');
            }
        });
    }
    
    async detectLocation() {
        const locationSpan = document.getElementById('currentLocation');
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    locationSpan.textContent = 'Location detected!';
                    await this.loadPrayerTimes(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                },
                (error) => {
                    console.error('Geolocation error:', error);
                    locationSpan.textContent = 'Using default location (Mecca)';
                    this.loadPrayerTimes(21.4225, 39.8262);
                }
            );
        } else {
            locationSpan.textContent = 'Geolocation not supported';
            this.loadPrayerTimes(21.4225, 39.8262);
        }
    }
    
    async loadPrayerTimes(lat, lng) {
        try {
            const date = new Date();
            const response = await fetch(
                `https://api.aladhan.com/v1/timings/${Math.floor(date.getTime()/1000)}?latitude=${lat}&longitude=${lng}&method=${this.state.currentMethod}`
            );
            
            const data = await response.json();
            this.state.prayerTimes = data.data.timings;
            this.state.hijriDate = data.data.date.hijri;
            
            this.renderPrayerTimes();
            this.updateHijriDate();
            
        } catch (error) {
            console.error('Failed to load prayer times:', error);
        }
    }
    
    renderPrayerTimes() {
        if (!this.state.prayerTimes) return;
        
        const prayers = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
        const container = document.getElementById('prayerCards');
        
        if (!container) return;
        
        container.innerHTML = prayers.map(prayer => `
            <div class="prayer-card glass">
                <div class="prayer-name">${prayer}</div>
                <div class="prayer-time">${this.state.prayerTimes[prayer]}</div>
            </div>
        `).join('');
    }
    
    updateHijriDate() {
        if (!this.state.hijriDate) return;
        
        const dayEl = document.getElementById('hijriDay');
        const monthEl = document.getElementById('hijriMonth');
        const yearEl = document.getElementById('hijriYear');
        
        if (dayEl) dayEl.textContent = String(this.state.hijriDate.day).padStart(2, '0');
        if (monthEl) monthEl.textContent = String(this.state.hijriDate.month.number).padStart(2, '0');
        if (yearEl) yearEl.textContent = this.state.hijriDate.year;
    }
    
    startCountdowns() {
        setInterval(() => {
            if (!this.state.prayerTimes) return;
            
            const now = new Date();
            
            // Iftar countdown (Maghrib)
            if (this.state.prayerTimes.Maghrib) {
                const [hours, minutes] = this.state.prayerTimes.Maghrib.split(':');
                const iftarTime = new Date();
                iftarTime.setHours(parseInt(hours), parseInt(minutes), 0);
                
                if (now > iftarTime) {
                    iftarTime.setDate(iftarTime.getDate() + 1);
                }
                
                const diff = iftarTime - now;
                const hours_left = Math.floor(diff / (1000 * 60 * 60));
                const minutes_left = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds_left = Math.floor((diff % (1000 * 60)) / 1000);
                
                const iftarTimer = document.getElementById('iftarTimer');
                if (iftarTimer) {
                    iftarTimer.textContent = `${String(hours_left).padStart(2,'0')}:${String(minutes_left).padStart(2,'0')}:${String(seconds_left).padStart(2,'0')}`;
                }
            }
            
            // Suhoor countdown (Fajr)
            if (this.state.prayerTimes.Fajr) {
                const [hours, minutes] = this.state.prayerTimes.Fajr.split(':');
                const suhoorTime = new Date();
                suhoorTime.setHours(parseInt(hours), parseInt(minutes), 0);
                
                if (now > suhoorTime) {
                    suhoorTime.setDate(suhoorTime.getDate() + 1);
                }
                
                const diff = suhoorTime - now;
                const hours_left = Math.floor(diff / (1000 * 60 * 60));
                const minutes_left = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds_left = Math.floor((diff % (1000 * 60)) / 1000);
                
                const suhoorTimer = document.getElementById('suhoorTimer');
                if (suhoorTimer) {
                    suhoorTimer.textContent = `${String(hours_left).padStart(2,'0')}:${String(minutes_left).padStart(2,'0')}:${String(seconds_left).padStart(2,'0')}`;
                }
            }
        }, 1000);
    }
    
    updateCalculationMethod() {
        const method = document.getElementById('calcMethod');
        if (method) {
            this.state.currentMethod = parseInt(method.value);
            this.detectLocation();
        }
    }
    
    updateSetting(key, value) {
        this.state.settings[key] = value;
        localStorage.setItem('settings', JSON.stringify(this.state.settings));
        console.log(`Setting ${key} updated to ${value}`);
    }
    
    async searchCity(query) {
        if (!query) return;
        
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
            );
            const data = await response.json();
            
            if (data.length > 0) {
                const loc = data[0];
                document.getElementById('currentLocation').textContent = loc.display_name.split(',')[0];
                this.loadPrayerTimes(parseFloat(loc.lat), parseFloat(loc.lon));
            }
        } catch (error) {
            console.error('Search failed:', error);
        }
    }
    
    addFavoriteCity() {
        const locationText = document.getElementById('currentLocation').textContent;
        if (locationText && locationText !== 'Loading location...' && locationText !== 'Using default location (Mecca)') {
            this.state.favorites.push({ city: locationText });
            localStorage.setItem('favoriteCities', JSON.stringify(this.state.favorites));
            this.renderFavoriteCities();
        }
    }
    
    renderFavoriteCities() {
        const container = document.getElementById('favoriteCities');
        if (!container) return;
        
        if (this.state.favorites.length === 0) {
            container.innerHTML = '<p>No favorite cities yet</p>';
            return;
        }
        
        container.innerHTML = this.state.favorites.map(city => `
            <div class="favorite-city" onclick="app.searchCity('${city.city}')">
                <i class="fas fa-city"></i> ${city.city}
            </div>
        `).join('');
    }
    
    changeMonth(direction) {
        console.log('Change month:', direction);
        // Implement calendar month change
    }
}

// Initialize app when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new RamadanApp();
});
