/**
 * Shitty Date Picker with interdependent spinning digits
 * Like an old mechanical odometer where digits affect each other
 */

const canvas = document.getElementById('gameCanvas');

// Make canvas responsive
function resizeCanvas() {
    const container = canvas.parentElement;
    const maxWidth = Math.min(800, window.innerWidth - 40);
    const aspectRatio = 600 / 800;
    canvas.width = maxWidth;
    canvas.height = maxWidth * aspectRatio;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const ctx = canvas.getContext('2d');

// Full-screen fireworks canvas
const fireworksCanvas = document.getElementById('fireworksCanvas');
const fireworksCtx = fireworksCanvas.getContext('2d');
fireworksCanvas.width = window.innerWidth;
fireworksCanvas.height = window.innerHeight;

// Date digits (MM-DD-YYYY format) - use proportional positioning
// gearRatio: how much this digit should spin relative to input (0.1 = 10x slower)
function getScaledX(baseX) {
    return (baseX / 800) * canvas.width;
}

function getScaledY(baseY) {
    return (baseY / 600) * canvas.height;
}

const digits = {
    month1: { value: 0, velocity: 0, baseX: 200, baseY: 200, label: 'M', gearRatio: Math.PI / 30 },   // Month tens - irrational ratio
    month2: { value: 1, velocity: 0, baseX: 250, baseY: 200, label: 'M', gearRatio: 1.0 },   // Month ones
    day1:   { value: 0, velocity: 0, baseX: 320, baseY: 200, label: 'D', gearRatio: Math.PI / 30 },   // Day tens - irrational ratio
    day2:   { value: 1, velocity: 0, baseX: 370, baseY: 200, label: 'D', gearRatio: 1.0 },   // Day ones
    year1:  { value: 2, velocity: 0, baseX: 450, baseY: 200, label: 'Y', gearRatio: Math.PI / 30 },   // Year thousands - irrational ratio
    year2:  { value: 0, velocity: 0, baseX: 500, baseY: 200, label: 'Y', gearRatio: Math.PI / 30 },   // Year hundreds - irrational ratio
    year3:  { value: 2, velocity: 0, baseX: 550, baseY: 200, label: 'Y', gearRatio: Math.PI / 30 },   // Year tens - irrational ratio
    year4:  { value: 5, velocity: 0, baseX: 600, baseY: 200, label: 'Y', gearRatio: 1.0 }    // Year ones
};

// Levers to control each section (spread out more)
const levers = {
    month: { baseX: 200, baseY: 385, angle: 0, dragging: false, target: ['month2', 'month1'] }, // Ones first, then tens
    day:   { baseX: 400, baseY: 385, angle: 0, dragging: false, target: ['day2', 'day1'] },
    year:  { baseX: 600, baseY: 385, angle: 0, dragging: false, target: ['year4'] } // Only control ones place, let physics drag the rest
};

const DRAG_INFLUENCE = 0.015; // How much adjacent digits affect each other
const FRICTION = 0.95;        // Friction to slow down spinning

// Challenge mode
let targetDate = null;
let showFireworks = false;
let fireworksTime = 0;
let particles = [];
let submittedDate = null;

// Tutorial arrows
let hasMovedLever = false;
let arrowAnimTime = 0;

// Easter egg - IDDQD cheat code
let konamiBuffer = '';
const CHEAT_CODE = 'iddqd';

// Submit button on canvas
const submitButton = {
    baseX: 350,
    baseY: 495,
    baseWidth: 100,
    baseHeight: 40,
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
    const scale = canvas.width / 800;
    const width = 48 * scale;  // 20% bigger (40 * 1.2)
    const height = 72 * scale; // 20% bigger (60 * 1.2)
    const x = getScaledX(digit.baseX);
    const y = getScaledY(digit.baseY);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Draw the digit box
    ctx.fillStyle = '#2c3e50';
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 2.4 * scale; // Also scale the line width
    ctx.fillRect(-width/2, -height/2, width, height);
    ctx.strokeRect(-width/2, -height/2, width, height);
    
    // Draw current digit and adjacent ones for smooth 3D scrolling effect
    const currentDigit = Math.floor(digit.value) % 10;
    const nextDigit = (currentDigit + 1) % 10;
    const prevDigit = (currentDigit + 9) % 10;
    // Tighter spacing - digits are 48px apart (scaled with 20% increase)
    const digitSpacing = 48;
    // Negative offset so digits scroll UP as value increases
    const fractional = digit.value % 1;
    const offset = -fractional * digitSpacing;
    
    // Determine which digit is most visible (for highlighting)
    const mostVisible = fractional < 0.5 ? 'current' : 'next';
    
    ctx.font = `bold ${43.2 * scale}px monospace`; // 20% bigger (36 * 1.2)
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
    ctx.font = `${14.4 * scale}px monospace`; // 20% bigger (12 * 1.2)
    ctx.textAlign = 'center';
    ctx.fillText(digit.label, x, y - 60 * scale); // Adjust spacing for bigger boxes
}

// Draw a lever
function drawLever(name, lever) {
    const scale = canvas.width / 800;
    const handleLength = 80 * scale;
    const baseX = getScaledX(lever.baseX);
    const baseY = getScaledY(lever.baseY);
    const handleX = baseX + Math.cos(lever.angle) * handleLength;
    const handleY = baseY + Math.sin(lever.angle) * handleLength;
    
    // Draw base
    ctx.fillStyle = '#34495e';
    ctx.beginPath();
    ctx.arc(baseX, baseY, 15 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    
    // Draw lever arm
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.lineTo(handleX, handleY);
    ctx.strokeStyle = lever.dragging ? '#e74c3c' : '#7f8c8d';
    ctx.lineWidth = 6 * scale;
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw handle
    ctx.fillStyle = lever.dragging ? '#e74c3c' : '#ff8c42';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
    
    // Draw tutorial arrows (only if user hasn't moved any lever yet)
    if (!hasMovedLever) {
        drawTutorialArrows(handleX, handleY, lever.angle, scale);
    }
    
    // Draw label
    ctx.fillStyle = '#34495e';
    ctx.font = `bold ${14 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(name.toUpperCase(), baseX, baseY + 35 * scale);
}

// Draw animated arrows around handle to indicate dragging
function drawTutorialArrows(handleX, handleY, leverAngle, scale) {
    // Oscillate position along the circular path (not rotation)
    const moveDistance = Math.sin(arrowAnimTime * 0.003) * 8 * scale; // Move back and forth
    const arrowSize = 15 * scale;
    const arrowDistance = 25 * scale;
    
    // Calculate perpendicular offset for circular motion
    const perpX = -Math.sin(leverAngle) * moveDistance;
    const perpY = Math.cos(leverAngle) * moveDistance;
    
    // Draw arrow on top (pointing upward)
    ctx.save();
    ctx.translate(handleX + perpX, handleY - arrowDistance + perpY);
    ctx.rotate(0); // Point up
    drawArrow(arrowSize, scale);
    ctx.restore();
    
    // Draw arrow on bottom (pointing downward)
    ctx.save();
    ctx.translate(handleX - perpX, handleY + arrowDistance - perpY);
    ctx.rotate(-Math.PI); // Point down
    drawArrow(arrowSize, scale);
    ctx.restore();
}

// Draw a single curved arrow
function drawArrow(size, scale) {
    ctx.fillStyle = '#e74c3c';
    ctx.globalAlpha = 0.8;
    
    // Draw curved arrow shape
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 0.5, size * 0.7);
    ctx.lineTo(-size * 0.2, size * 0.5);
    ctx.lineTo(size * 0.2, size * 0.5);
    ctx.lineTo(size * 0.5, size * 0.7);
    ctx.closePath();
    ctx.fill();
    
    // Add a subtle stroke
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 1 * scale;
    ctx.stroke();
    
    ctx.globalAlpha = 1.0;
}

// Draw separators - removed for cleaner odometer look
function drawSeparators() {
    // No separators - cleaner odometer appearance
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

// Mouse/Touch handling for levers
let mouseX = 0;
let mouseY = 0;
let previousMouseAngle = 0;

function getEventCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    if (e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function handlePointerDown(e) {
    e.preventDefault();
    const coords = getEventCoordinates(e);
    mouseX = coords.x;
    mouseY = coords.y;
    
    const scale = canvas.width / 800;
    
    // Check if clicking submit button
    const buttonX = getScaledX(submitButton.baseX);
    const buttonY = getScaledY(submitButton.baseY);
    const buttonWidth = submitButton.baseWidth * scale;
    const buttonHeight = submitButton.baseHeight * scale;
    
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
        const handleLength = 80 * scale;
        const baseX = getScaledX(lever.baseX);
        const baseY = getScaledY(lever.baseY);
        const handleX = baseX + Math.cos(lever.angle) * handleLength;
        const handleY = baseY + Math.sin(lever.angle) * handleLength;
        const dist = Math.sqrt((mouseX - handleX) ** 2 + (mouseY - handleY) ** 2);
        
        if (dist < 20 * scale) {
            lever.dragging = true;
            hasMovedLever = true; // Hide tutorial arrows once user interacts
            previousMouseAngle = Math.atan2(mouseY - baseY, mouseX - baseX);
        }
    });
}

function handlePointerMove(e) {
    e.preventDefault();
    const coords = getEventCoordinates(e);
    mouseX = coords.x;
    mouseY = coords.y;
    
    const scale = canvas.width / 800;
    
    // Check if hovering over submit button
    const buttonX = getScaledX(submitButton.baseX);
    const buttonY = getScaledY(submitButton.baseY);
    const buttonWidth = submitButton.baseWidth * scale;
    const buttonHeight = submitButton.baseHeight * scale;
    
    submitButton.hovered = mouseX >= buttonX && 
                           mouseX <= buttonX + buttonWidth &&
                           mouseY >= buttonY && 
                           mouseY <= buttonY + buttonHeight;
    
    Object.keys(levers).forEach(name => {
        const lever = levers[name];
        if (lever.dragging) {
            const baseX = getScaledX(lever.baseX);
            const baseY = getScaledY(lever.baseY);
            const currentAngle = Math.atan2(mouseY - baseY, mouseX - baseX);
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
        const handleLength = 80 * scale;
        const baseX = getScaledX(lever.baseX);
        const baseY = getScaledY(lever.baseY);
        const handleX = baseX + Math.cos(lever.angle) * handleLength;
        const handleY = baseY + Math.sin(lever.angle) * handleLength;
        const dist = Math.sqrt((mouseX - handleX) ** 2 + (mouseY - handleY) ** 2);
        if (dist < 20 * scale) overHandle = true;
    });
    canvas.style.cursor = (overHandle || submitButton.hovered) ? 'pointer' : 'default';
}

function handlePointerUp(e) {
    e.preventDefault();
    Object.keys(levers).forEach(name => {
        levers[name].dragging = false;
    });
}

// Add event listeners for both mouse and touch
canvas.addEventListener('mousedown', handlePointerDown);
canvas.addEventListener('mousemove', handlePointerMove);
canvas.addEventListener('mouseup', handlePointerUp);
canvas.addEventListener('mouseleave', handlePointerUp);

canvas.addEventListener('touchstart', handlePointerDown);
canvas.addEventListener('touchmove', handlePointerMove);
canvas.addEventListener('touchend', handlePointerUp);
canvas.addEventListener('touchcancel', handlePointerUp);

// Easter egg - listen for IDDQD cheat code
document.addEventListener('keydown', (e) => {
    konamiBuffer += e.key.toLowerCase();
    
    // Keep buffer to last 10 characters
    if (konamiBuffer.length > 10) {
        konamiBuffer = konamiBuffer.slice(-10);
    }
    
    // Check if buffer ends with the cheat code
    if (konamiBuffer.endsWith(CHEAT_CODE)) {
        // Trigger fireworks!
        showFireworks = true;
        fireworksTime = Date.now();
        fireworksCanvas.style.display = 'block';
        createFireworks();
        createFireworks();
        setTimeout(() => createFireworks(), 200);
        setTimeout(() => createFireworks(), 400);
        setTimeout(() => createFireworks(), 600);
        setTimeout(() => createFireworks(), 800);
        
        // Clear buffer
        konamiBuffer = '';
    }
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
    
    // Update arrow animation
    arrowAnimTime = Date.now();
    
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
    
    const scale = canvas.width / 800;
    
    // Draw target date (LEFT SIDE)
    if (targetDate) {
        ctx.fillStyle = '#34495e';
        ctx.font = `${21 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Target Date:', getScaledX(200), getScaledY(500));
        
        ctx.fillStyle = '#e74c3c';
        ctx.font = `bold ${30 * scale}px monospace`;
        ctx.fillText(`${String(targetDate.month).padStart(2, '0')}-${String(targetDate.day).padStart(2, '0')}-${targetDate.year}`, 
                     getScaledX(200), getScaledY(535));
    }
    
    // Display current date (RIGHT SIDE)
    const date = getCurrentDate();
    ctx.fillStyle = '#34495e';
    ctx.font = `${21 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Selected Date:', getScaledX(600), getScaledY(500));
    
    ctx.fillStyle = '#2c3e50';
    ctx.font = `bold ${30 * scale}px monospace`;
    ctx.fillText(`${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}-${date.year}`, 
                 getScaledX(600), getScaledY(535));
    
    // Draw submit button (between the dates, with shake effect)
    const buttonX = getScaledX(submitButton.baseX) + submitButton.shakeOffset * scale;
    const buttonY = getScaledY(submitButton.baseY);
    const buttonWidth = submitButton.baseWidth * scale;
    const buttonHeight = submitButton.baseHeight * scale;
    
    ctx.fillStyle = submitButton.hovered ? '#45a049' : '#4CAF50';
    ctx.fillRect(buttonX, buttonY, buttonWidth, buttonHeight);
    ctx.strokeStyle = submitButton.shaking ? '#e74c3c' : '#2c3e50';
    ctx.lineWidth = submitButton.shaking ? 3 * scale : 2 * scale;
    ctx.strokeRect(buttonX, buttonY, buttonWidth, buttonHeight);
    
    ctx.fillStyle = 'white';
    ctx.font = `bold ${16 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Submit', buttonX + buttonWidth / 2, buttonY + buttonHeight / 2);
    
    // Draw success message on main canvas
    if (showFireworks) {
        ctx.fillStyle = '#27ae60';
        ctx.font = `bold ${72 * scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('🎉 SUCCESS! 🎉', canvas.width / 2, getScaledY(100));
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
