class DigitalRain {
    constructor(interval = 70) {
        this.canvas = document.getElementById('ad');
        this.ctx = this.canvas.getContext('2d');
        this.chars = '0101'.split('');
        this.colors = ['#5BA4CF', '#2E86C1', '#7EC8E3', '#AED6F1'];
        this.fontSize = 20;
        
        this.drops = [];
        this.frameCount = 0;
        this.intervalId = null;
        this.intervalTime = interval;
        
        this.init();
        this.bindEvents();
    }
    
    init() {
        this.resizeCanvas();
        this.initDrops();
        this.startAnimation();
    }
    
    bindEvents() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.resizeCanvas();
                this.initDrops();
            }, 250);
        });

        // 监听其他标签页修改 localStorage，实现多标签页同步
        window.addEventListener('storage', (e) => {
            if (e.key === 'rainEnabled') {
                this.syncButtonState(e.newValue !== 'false');
                if (e.newValue === 'false') {
                    this.stopAnimation();
                } else {
                    this.startAnimation();
                }
            }
        });
    }

    // 同步按钮视觉状态
    syncButtonState(enabled) {
        const btn = document.getElementById('rainToggle');
        if (!btn) return;
        if (enabled) {
            btn.textContent = '🌧';
            btn.title = '关闭雨效果';
            btn.classList.remove('rain-off');
        } else {
            btn.textContent = '☀️';
            btn.title = '开启雨效果';
            btn.classList.add('rain-off');
        }
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    initDrops() {
        const columns = Math.floor(this.canvas.width / this.fontSize);
        this.drops = new Array(columns).fill(1);
    }
    
    draw() {
        this.frameCount++;
        
        // 使用离屏渲染优化性能
        this.ctx.fillStyle = 'rgba(234, 244, 251, 0.15)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.font = `${this.fontSize}px 'Courier New', monospace`;
        this.ctx.textBaseline = 'top';
        
        // 批量绘制优化
        for (let i = 0; i < this.drops.length; i++) {
            const char = this.chars[(i + this.frameCount) % this.chars.length];
            this.ctx.fillStyle = this.colors[i % this.colors.length];
            this.ctx.fillText(char, i * this.fontSize, this.drops[i] * this.fontSize);
            
            if (this.drops[i] * this.fontSize > this.canvas.height && Math.random() > 0.975) {
                this.drops[i] = 0;
            }
            this.drops[i]++;
        }
    }
    
    startAnimation() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
        this.intervalId = setInterval(() => this.draw(), this.intervalTime);
    }
    
    stopAnimation() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.digitalRain = new DigitalRain(70); // 70ms ≈ 14fps

    // 读取全局开关状态
    if (localStorage.getItem('rainEnabled') === 'false') {
        window.digitalRain.stopAnimation();
        window.digitalRain.syncButtonState(false);
    }
});