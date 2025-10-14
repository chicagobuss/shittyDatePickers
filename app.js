/**
 * Shitty Date Picker with interdependent spinning digits
 * Like an old mechanical odometer where digits affect each other
 */

const canvas = document.getElementById('gameCanvas');
canvas.width = 800;
canvas.height = 600;
const ctx = canvas.getContext('2d');

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

const DRAG_INFLUENCE = 0.15; // How much adjacent digits affect each other
const FRICTION = 0.95; // Friction to slow down spinning

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
    
    // Draw current digit and adjacent ones for 3D effect
    const currentDigit = Math.floor(digit.value) % 10;
    const nextDigit = (currentDigit + 1) % 10;
    const prevDigit = (currentDigit + 9) % 10;
    const offset = (digit.value % 1) * height;
    
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Draw previous digit (above)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(prevDigit, 0, -height + offset);
    
    // Draw current digit
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText(currentDigit, 0, offset);
    
    // Draw next digit (below)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.fillText(nextDigit, 0, height + offset);
    
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
    
    // Apply drag influence between adjacent digits
    for (let i = 0; i < digitKeys.length - 1; i++) {
        const current = digits[digitKeys[i]];
        const next = digits[digitKeys[i + 1]];
        
        // When one digit spins, it drags the adjacent ones
        const velDiff = current.velocity - next.velocity;
        const drag = velDiff * DRAG_INFLUENCE;
        
        next.velocity += drag;
        current.velocity -= drag * 0.3; // Back-drag (smaller effect)
    }
}

// Mouse handling for levers
let mouseX = 0;
let mouseY = 0;
let previousMouseAngle = 0;

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
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
    canvas.style.cursor = overHandle ? 'grab' : 'default';
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

// Get current date value
function getCurrentDate() {
    const month = Math.floor(digits.month1.value % 10) * 10 + Math.floor(digits.month2.value % 10);
    const day = Math.floor(digits.day1.value % 10) * 10 + Math.floor(digits.day2.value % 10);
    const year = Math.floor(digits.year1.value % 10) * 1000 + 
                 Math.floor(digits.year2.value % 10) * 100 + 
                 Math.floor(digits.year3.value % 10) * 10 + 
                 Math.floor(digits.year4.value % 10);
    return { month, day, year };
}

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Background
    ctx.fillStyle = '#ecf0f1';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Minimal header spacing
    // (no title needed)
    
    // Update physics
    update();
    
    // Draw digits
    Object.values(digits).forEach(digit => drawDigit(digit));
    
    // Draw separators
    drawSeparators();
    
    // Draw levers
    Object.keys(levers).forEach(name => drawLever(name, levers[name]));
    
    // Display current date (minimal)
    const date = getCurrentDate();
    ctx.fillStyle = '#2c3e50';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}-${date.year}`, 
                 canvas.width / 2, 520);
    
    requestAnimationFrame(animate);
}

// Controls (simplified)
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
