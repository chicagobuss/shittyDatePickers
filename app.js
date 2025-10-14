/**
 * Shitty Date Picker with interdependent spinning digits
 * Like an old mechanical odometer where digits affect each other
 */

const canvas = document.getElementById('gameCanvas');
canvas.width = 800;
canvas.height = 600;
const ctx = canvas.getContext('2d');

// Full-screen fireworks canvas
const fireworksCanvas = document.getElementById('fireworksCanvas');
const fireworksCtx = fireworksCanvas.getContext('2d');
fireworksCanvas.width = window.innerWidth;
fireworksCanvas.height = window.innerHeight;

// Date digits (MM-DD-YYYY format) - spread out across canvas
// gearRatio: how much this digit should spin relative to input (0.1 = 10x slower)
const digits = {
    month1: { value: 0, velocity: 0, x: 160, y: 200, label: 'M', gearRatio: 0.1 },   // Month tens
    month2: { value: 1, velocity: 0, x: 210, y: 200, label: 'M', gearRatio: 1.0 },   // Month ones
    day1:   { value: 0, velocity: 0, x: 310, y: 200, label: 'D', gearRatio: 0.1 },   // Day tens
    day2:   { value: 1, velocity: 0, x: 360, y: 200, label: 'D', gearRatio: 1.0 },   // Day ones
    year1:  { value: 2, velocity: 0, x: 470, y: 200, label: 'Y', gearRatio: 0.1 },   // Year thousands
    year2:  { value: 0, velocity: 0, x: 520, y: 200, label: 'Y', gearRatio: 0.1 },   // Year hundreds
    year3:  { value: 2, velocity: 0, x: 570, y: 200, label: 'Y', gearRatio: 0.1 },   // Year tens
    year4:  { value: 5, velocity: 0, x: 620, y: 200, label: 'Y', gearRatio: 1.0 }    // Year ones
};

// Levers to control each section (spread out more)
const levers = {
    month: { x: 200, y: 400, angle: 0, dragging: false, target: ['month2', 'month1'] }, // Ones first, then tens
    day:   { x: 400, y: 400, angle: 0, dragging: false, target: ['day2', 'day1'] },
    year:  { x: 600, y: 400, angle: 0, dragging: false, target: ['year4', 'year3', 'year2', 'year1'] }
};

const DRAG_INFLUENCE = 0.025; // How much adjacent digits affect each other (50% less than before)
const FRICTION = 0.95; // Friction to slow down spinning

// Challenge mode
let targetDate = null;
let showFireworks = false;
let fireworksTime = 0;
let particles = [];
let submittedDate = null;

// Submit button on canvas
const submitButton = {
    x: 350,
    y: 495,
    width: 100,
    height: 40,
    hovered: false,
    shaking: false,
    shakeOffset: 0,
    shakeTime: 0
};

function generateTargetDate() {
    const month = Math.floor(Math.random() * 12) + 1; // 1-12
    const day = Math.floor(Math.random() * 28) + 1; // 1-28 (safe for all months)
    const year = Math.floor(Math.random() * (2030 - 2020 + 1)) + 2020; // 2020-2030
    targetDate = { month, day, year };
}

function checkMatch() {
    if (!targetDate || !submittedDate) return false;
    return submittedDate.month === targetDate.month && 
           submittedDate.day === targetDate.day && 
           submittedDate.year === targetDate.year;
}

// Fireworks particle system (full screen!)
function createFireworks() {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    
    for (let i = 0; i < 80; i++) {
        const angle = (Math.PI * 2 * i) / 80;
        const speed = 3 + Math.random() * 5;
        particles.push({
            x: centerX,
            y: centerY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`
        });
    }
}

function updateFireworks() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // Gravity
        p.life -= 0.015;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawFireworks() {
    // Clear the full-screen canvas
    fireworksCtx.clearRect(0, 0, fireworksCanvas.width, fireworksCanvas.height);
    
    particles.forEach(p => {
        fireworksCtx.fillStyle = p.color;
        fireworksCtx.globalAlpha = p.life;
        fireworksCtx.beginPath();
        fireworksCtx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        fireworksCtx.fill();
        
        // Add a glow effect
        fireworksCtx.shadowBlur = 15;
        fireworksCtx.shadowColor = p.color;
    });
    fireworksCtx.globalAlpha = 1.0;
    fireworksCtx.shadowBlur = 0;
}

// Initialize target
generateTargetDate();

// Draw a spinning digit wheel
function drawDigit(digit) {
    const width = 40;
    const height = 60;
    const radius = 100; // Virtual cylinder radius
    
    ctx.save();
    ctx.translate(digit.x, digit.y);
    
    // Draw the digit box
    ctx.fillStyle = '#2c3e50';
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2;
    ctx.fillRect(-width/2, -height/2, width, height);
    ctx.strokeRect(-width/2, -height/2, width, height);
    
    // Draw current digit and adjacent ones for smooth 3D scrolling effect
    const currentDigit = Math.floor(digit.value) % 10;
    const nextDigit = (currentDigit + 1) % 10;
    const prevDigit = (currentDigit + 9) % 10;
    // Tighter spacing - digits are 40px apart instead of 60px
    const digitSpacing = 40;
    // Negative offset so digits scroll UP as value increases
    const fractional = digit.value % 1;
    const offset = -fractional * digitSpacing;
    
    // Determine which digit is most visible (for highlighting)
    const mostVisible = fractional < 0.5 ? 'current' : 'next';
    
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Clip to box so digits don't overflow
    ctx.save();
    ctx.beginPath();
    ctx.rect(-width/2, -height/2, width, height);
    ctx.clip();
    
    // Draw previous digit (above)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(prevDigit, 0, -digitSpacing + offset);
    
    // Draw current digit (bright if most visible)
    ctx.fillStyle = mostVisible === 'current' ? '#ecf0f1' : 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(currentDigit, 0, offset);
    
    // Draw next digit (below, bright if most visible)
    ctx.fillStyle = mostVisible === 'next' ? '#ecf0f1' : 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(nextDigit, 0, digitSpacing + offset);
    
    ctx.restore();
    
    ctx.restore();
    
    // Draw label
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(digit.label, digit.x, digit.y - 50);
}

// Draw a lever
function drawLever(name, lever) {
    const handleLength = 80;
    const baseX = lever.x;
    const baseY = lever.y;
    const handleX = baseX + Math.cos(lever.angle) * handleLength;
    const handleY = baseY + Math.sin(lever.angle) * handleLength;
    
    // Draw base
    ctx.fillStyle = '#34495e';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw lever arm
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(handleX, handleY);
    ctx.strokeStyle = lever.dragging ? '#e74c3c' : '#7f8c8d';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw handle
    ctx.fillStyle = lever.dragging ? '#e74c3c' : '#95a5a6';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw label
    ctx.fillStyle = '#34495e';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase(), baseX, baseY + 35);
}

// Draw separators
function drawSeparators() {
    ctx.fillStyle = '#34495e';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('-', 265, 200); // Between month and day
    ctx.fillText('-', 420, 200); // Between day and year
}

// Update physics
function update() {
    const digitKeys = Object.keys(digits);
    
    // Apply friction to all digits
    digitKeys.forEach(key => {
        digits[key].velocity *= FRICTION;
        digits[key].value += digits[key].velocity;
        
        // Keep value positive for proper modulo
        if (digits[key].value < 0) digits[key].value += 1000;
    });
    
    // Apply realistic constraints (the false hope!)
    // Month tens can ONLY be 0 or 1 (wrap before it would round to 2)
    const month1Base = Math.floor(digits.month1.value / 10) * 10;
    const month1Digit = digits.month1.value % 10;
    if (month1Digit >= 1.5) {
        // Wrap at 1.5 so it never rounds to 2
        // Map 1.5->0.0, 1.7->0.2, etc.
        const wrapped = month1Digit - 1.5;
        digits.month1.value = month1Base + wrapped;
    }
    
    // Day tens can only be 0-3 (wrap before it would round to 4)
    const day1Base = Math.floor(digits.day1.value / 10) * 10;
    const day1Digit = digits.day1.value % 10;
    if (day1Digit >= 3.5) {
        // Wrap at 3.5 so it never rounds to 4
        const wrapped = day1Digit - 3.5;
        digits.day1.value = day1Base + wrapped;
    }
    
    // Apply drag influence between adjacent digits WITHIN each section only
    // Month section
    const monthVelDiff = digits.month1.velocity - digits.month2.velocity;
    const monthDrag = monthVelDiff * DRAG_INFLUENCE;
    digits.month2.velocity += monthDrag;
    digits.month1.velocity -= monthDrag * 0.3;
    
    // Day section
    const dayVelDiff = digits.day1.velocity - digits.day2.velocity;
    const dayDrag = dayVelDiff * DRAG_INFLUENCE;
    digits.day2.velocity += dayDrag;
    digits.day1.velocity -= dayDrag * 0.3;
    
    // Year section (cascade through all 4 digits)
    const year1to2Diff = digits.year1.velocity - digits.year2.velocity;
    const year1to2Drag = year1to2Diff * DRAG_INFLUENCE;
    digits.year2.velocity += year1to2Drag;
    digits.year1.velocity -= year1to2Drag * 0.3;
    
    const year2to3Diff = digits.year2.velocity - digits.year3.velocity;
    const year2to3Drag = year2to3Diff * DRAG_INFLUENCE;
    digits.year3.velocity += year2to3Drag;
    digits.year2.velocity -= year2to3Drag * 0.3;
    
    const year3to4Diff = digits.year3.velocity - digits.year4.velocity;
    const year3to4Drag = year3to4Diff * DRAG_INFLUENCE;
    digits.year4.velocity += year3to4Drag;
    digits.year3.velocity -= year3to4Drag * 0.3;
    
    // EVIL CROSS-CONNECTIONS for maximum chaos!
    // Day digits drag the year ONES place
    const dayVel = (digits.day1.velocity + digits.day2.velocity) / 2;
    const dayToYearDrag = dayVel * DRAG_INFLUENCE * 0.8;
    digits.year4.velocity += dayToYearDrag;
    
    // Year ones place drags the month TENS place (circular dependency!)
    const yearOnesToMonthDrag = digits.year4.velocity * DRAG_INFLUENCE * 0.8;
    digits.month1.velocity += yearOnesToMonthDrag;
}

// Mouse handling for levers
let mouseX = 0;
let mouseY = 0;
let previousMouseAngle = 0;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    // Check if clicking submit button
    if (submitButton.hovered) {
        submittedDate = getCurrentDate();
        
        // Check for match
        if (checkMatch()) {
            showFireworks = true;
            fireworksTime = Date.now();
            fireworksCanvas.style.display = 'block';
            createFireworks();
            createFireworks(); // Multiple bursts!
            setTimeout(() => createFireworks(), 200);
            setTimeout(() => createFireworks(), 400);
            setTimeout(() => createFireworks(), 600);
            setTimeout(() => createFireworks(), 800);
        } else {
            // Wrong answer - shake the button!
            submitButton.shaking = true;
            submitButton.shakeTime = Date.now();
        }
        return;
    }
    
    // Check if clicking on any lever handle
    Object.keys(levers).forEach(name => {
        const lever = levers[name];
        const handleLength = 80;
        const handleX = lever.x + Math.cos(lever.angle) * handleLength;
        const handleY = lever.y + Math.sin(lever.angle) * handleLength;
        const dist = Math.sqrt((mouseX - handleX) ** 2 + (mouseY - handleY) ** 2);
        
        if (dist < 20) {
            lever.dragging = true;
            previousMouseAngle = Math.atan2(mouseY - lever.y, mouseX - lever.x);
        }
    });
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    // Check if hovering over submit button
    submitButton.hovered = mouseX >= submitButton.x && 
                           mouseX <= submitButton.x + submitButton.width &&
                           mouseY >= submitButton.y && 
                           mouseY <= submitButton.y + submitButton.height;
    
    Object.keys(levers).forEach(name => {
        const lever = levers[name];
        if (lever.dragging) {
            const currentAngle = Math.atan2(mouseY - lever.y, mouseX - lever.x);
            let angleDelta = currentAngle - previousMouseAngle;
            
            // Handle angle wrapping
            if (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
            if (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
            
            lever.angle = currentAngle;
            previousMouseAngle = currentAngle;
            
            // Apply velocity to target digits (25% less sensitive)
            // Use gearRatio to make tens/hundreds digits spin slower
            const speed = angleDelta * 1.5;
            lever.target.forEach(digitKey => {
                const digit = digits[digitKey];
                digits[digitKey].velocity += speed * digit.gearRatio;
            });
        }
    });
    
    // Update cursor
    let overHandle = false;
    Object.keys(levers).forEach(name => {
        const lever = levers[name];
        const handleLength = 80;
        const handleX = lever.x + Math.cos(lever.angle) * handleLength;
        const handleY = lever.y + Math.sin(lever.angle) * handleLength;
        const dist = Math.sqrt((mouseX - handleX) ** 2 + (mouseY - handleY) ** 2);
        if (dist < 20) overHandle = true;
    });
    canvas.style.cursor = (overHandle || submitButton.hovered) ? 'pointer' : 'default';
});

canvas.addEventListener('mouseup', () => {
    Object.keys(levers).forEach(name => {
        levers[name].dragging = false;
    });
});

canvas.addEventListener('mouseleave', () => {
    Object.keys(levers).forEach(name => {
        levers[name].dragging = false;
    });
});

// Get current date value (round to nearest visible digit)
function getCurrentDate() {
    const roundDigit = (val) => Math.round(val) % 10;
    const month = roundDigit(digits.month1.value) * 10 + roundDigit(digits.month2.value);
    const day = roundDigit(digits.day1.value) * 10 + roundDigit(digits.day2.value);
    const year = roundDigit(digits.year1.value) * 1000 + 
                 roundDigit(digits.year2.value) * 100 + 
                 roundDigit(digits.year3.value) * 10 + 
                 roundDigit(digits.year4.value);
    return { month, day, year };
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Update physics
    update();
    
    // Update shake animation
    if (submitButton.shaking) {
        const elapsed = Date.now() - submitButton.shakeTime;
        if (elapsed < 500) {
            // Shake with decreasing intensity
            const intensity = 10 * (1 - elapsed / 500);
            submitButton.shakeOffset = Math.sin(elapsed * 0.05) * intensity;
        } else {
            submitButton.shaking = false;
            submitButton.shakeOffset = 0;
        }
    }
    
    // Update fireworks
    if (showFireworks) {
        updateFireworks();
        drawFireworks();
        
        // End fireworks after 4 seconds
        if (Date.now() - fireworksTime > 4000 && particles.length === 0) {
            showFireworks = false;
            fireworksCanvas.style.display = 'none';
            generateTargetDate(); // New challenge!
        }
    }
    
    // Draw digits
    Object.values(digits).forEach(digit => drawDigit(digit));
    
    // Draw separators
    drawSeparators();
    
    // Draw levers
    Object.keys(levers).forEach(name => drawLever(name, levers[name]));
    
    // Draw target date (LEFT SIDE)
    if (targetDate) {
        ctx.fillStyle = '#34495e';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Target Date:', 200, 500);
        
        ctx.fillStyle = '#e74c3c';
        ctx.font = 'bold 20px monospace';
        ctx.fillText(`${String(targetDate.month).padStart(2, '0')}-${String(targetDate.day).padStart(2, '0')}-${targetDate.year}`, 
                     200, 525);
    }
    
    // Display current date (RIGHT SIDE)
    const date = getCurrentDate();
    ctx.fillStyle = '#34495e';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Selected Date:', 600, 500);
    
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}-${date.year}`, 
                 600, 525);
    
    // Draw submit button (between the dates, with shake effect)
    const buttonX = submitButton.x + submitButton.shakeOffset;
    ctx.fillStyle = submitButton.hovered ? '#45a049' : '#4CAF50';
    ctx.fillRect(buttonX, submitButton.y, submitButton.width, submitButton.height);
    ctx.strokeStyle = submitButton.shaking ? '#e74c3c' : '#2c3e50';
    ctx.lineWidth = submitButton.shaking ? 3 : 2;
    ctx.strokeRect(buttonX, submitButton.y, submitButton.width, submitButton.height);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Submit', buttonX + submitButton.width / 2, submitButton.y + submitButton.height / 2);
    
    // Draw success message on main canvas
    if (showFireworks) {
        ctx.fillStyle = '#27ae60';
        ctx.font = 'bold 72px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🎉 SUCCESS! 🎉', canvas.width / 2, 100);
    }
    
    requestAnimationFrame(animate);
}

// Controls
document.getElementById('resetBtn').addEventListener('click', () => {
    digits.month1.value = 0;
    digits.month1.velocity = 0;
    digits.month2.value = 1;
    digits.month2.velocity = 0;
    digits.day1.value = 0;
    digits.day1.velocity = 0;
    digits.day2.value = 1;
    digits.day2.velocity = 0;
    digits.year1.value = 2;
    digits.year1.velocity = 0;
    digits.year2.value = 0;
    digits.year2.velocity = 0;
    digits.year3.value = 2;
    digits.year3.velocity = 0;
    digits.year4.value = 5;
    digits.year4.velocity = 0;
});

// Start animation
animate();

console.log('Shitty Date Picker loaded!');
