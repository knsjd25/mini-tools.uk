const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const goldDisplay = document.getElementById('gold-count');
const lane = document.getElementById('customer-lane');
const taskInfo = document.getElementById('task-info');
const interactArea = document.getElementById('interact-area');

canvas.width = 400; canvas.height = 650;

const FOODS = {
    'POTATO': { icon: '🍠', price: 20, type: 'READY' },
    'TART':   { icon: '🥧', price: 25, type: 'READY' },
    'MILK':   { icon: '🥛', price: 15, type: 'READY' },
    'FRIES':  { icon: '🍟', price: 80, type: 'FRY' },
    'CAKE':   { icon: '🎂', price: 400, type: 'CAKE' }
};

let gold = 2000, unlocked = { FRY: false, CAKE: false };
let customers = [], activeCustID = null, isGaming = false, currentMode = '';
let justClosedGame = false;

function init() {
    updateGoldUI();
    spawnCustomer();
    setInterval(spawnCustomer, 6000);
    setInterval(tick, 100);
}

// 核心修复：仅针对传入的 el 进行抖动，并防止背景变色
function triggerError(el, msg) {
    if (justClosedGame || !el) return;
    
    el.classList.remove('shake-it');
    void el.offsetWidth; // 触发回流以重启动画
    el.classList.add('shake-it');
    setTimeout(() => el.classList.remove('shake-it'), 300);

    taskInfo.innerText = msg;
    taskInfo.classList.remove('warn-text');
    void taskInfo.offsetWidth;
    taskInfo.classList.add('warn-text');
}

function spawnCustomer() {
    if (customers.length >= 4 || isGaming) return;
    const posList = [15, 38, 62, 85];
    const freePos = [0,1,2,3].filter(p => !customers.map(c => c.posIdx).includes(p));
    if (!freePos.length) return;
    const myPos = freePos[Math.floor(Math.random() * freePos.length)];

    let key = Object.keys(FOODS)[Math.floor(Math.random()*5)];
    if (FOODS[key].type === 'FRY' && !unlocked.FRY) key = 'POTATO';
    if (FOODS[key].type === 'CAKE' && !unlocked.CAKE) key = 'TART';

    const id = "c-" + Date.now();
    customers.push({ id, type: key, patience: 100, posIdx: myPos, isAngry: false });

    const slot = document.createElement('div');
    slot.className = 'cust-slot walking'; slot.id = id; slot.style.left = posList[myPos] + "%";
    slot.innerHTML = `
        <div class="bubble" id="b-${id}">${FOODS[key].icon}</div>
        <div class="char-step"><div class="cust-body" onclick="selectCust(event, '${id}')"></div></div>
        <div class="p-bar"><div class="p-fill" id="f-${id}" style="width:100%"></div></div>
    `;
    lane.appendChild(slot);
    setTimeout(() => slot.classList.remove('walking'), 1800);
}

function selectCust(e, id) {
    e.stopPropagation();
    if (justClosedGame) return;
    const c = customers.find(x => x.id === id);
    if (!c || c.isAngry) return;
    activeCustID = id;
    document.querySelectorAll('.cust-slot').forEach(el => el.classList.toggle('active', el.id === id));
    taskInfo.innerText = "正在制作: " + FOODS[c.type].icon;
}

function tick() {
    if (isGaming) return;
    customers.forEach(c => {
        if (c.isAngry) return;
        c.patience -= 0.35;
        const bar = document.getElementById(`f-${c.id}`);
        if (bar) bar.style.width = c.patience + "%";
        if (c.patience <= 0) makeAngry(c.id);
    });
}

function serveReady(foodKey, e) {
    e.stopPropagation();
    if (justClosedGame) return;
    let el = e.currentTarget;
    if (!activeCustID) { triggerError(el, "请点击小猫选择顾客！"); return; }
    const cust = customers.find(c => c.id === activeCustID);
    if (cust.type === foodKey) {
        gold += FOODS[foodKey].price; updateGoldUI(); removeCust(activeCustID);
    } else {
        makeAngry(activeCustID);
    }
}

function clickEquip(mode, e) {
    e.stopPropagation();
    if (justClosedGame) return;
    let el = e.currentTarget;
    if (!unlocked[mode]) {
        let cost = mode === 'FRY' ? 500 : 1000;
        if (gold >= cost) { gold -= cost; unlocked[mode] = true; updateGoldUI(); } 
        else triggerError(el, "金币不足！");
        return;
    }
    if (!activeCustID) { triggerError(el, "请点击小猫选择顾客！"); return; }
    const cust = customers.find(c => c.id === activeCustID);
    if (FOODS[cust.type].type === mode) startMiniGame(mode);
    else triggerError(el, "设备不匹配！");
}

function makeAngry(id) {
    const cust = customers.find(c => c.id === id);
    if (!cust || cust.isAngry) return;
    cust.isAngry = true;
    const el = document.getElementById(id);
    if (el) { el.classList.add('angry'); const b = document.getElementById(`b-${id}`); if (b) b.innerText = "💢"; }
    setTimeout(() => removeCust(id), 1200);
}

function removeCust(id) {
    const el = document.getElementById(id);
    if (el) { el.classList.add('leaving'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 750); }
    customers = customers.filter(c => c.id !== id);
    if (activeCustID === id) activeCustID = null;
    updateGoldUI();
}

function updateGoldUI() {
    goldDisplay.innerText = gold;
    if (unlocked.FRY) { document.getElementById('fry-ico').innerText = "🍟"; document.getElementById('equip-fry').classList.remove('locked'); }
    if (unlocked.CAKE) { document.getElementById('oven-ico').innerText = "🎂"; document.getElementById('equip-oven').classList.remove('locked'); }
}

// --- 叠蛋糕：摄像机与视野优化 ---
let cakes = [], moving = null, score = 0, cameraY = 0, lerpY = 0, fryX = 0;

function startMiniGame(mode) {
    isGaming = true; currentMode = mode; justClosedGame = false;
    document.getElementById('story-ui').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    if (mode === 'FRY') {
        document.getElementById('fry-bar').classList.remove('hidden'); fryX = 0;
    } else {
        score = 0; document.getElementById('score-val').innerText = 0;
        // 核心修正：初始 Y 轴设为 520 (总高650)，确保可见
        cakes = [{x: 75, y: 520, w: 250, c: '#f48fb1'}];
        cameraY = 0; lerpY = 0; spawnCake();
    }
}

function spawnCake() {
    const last = cakes[cakes.length-1];
    moving = { x: -last.w, y: last.y-45, w: last.w, c: '#81d4fa', s: 5 + score*0.6, active: true };
}

function drawCake(obj) {
    ctx.fillStyle = obj.c; ctx.beginPath(); ctx.roundRect(obj.x, obj.y, obj.w, 45, 12); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)"; ctx.fillRect(obj.x+5, obj.y, obj.w-10, 8);
}

function loop() {
    if (isGaming) {
        ctx.clearRect(0,0,400,650);
        if (currentMode === 'CAKE') {
            if (moving.active) { moving.x += moving.s; if(moving.x>400) moving.x = -moving.w; }
            
            // 摄像机死区修复：只有当蛋糕叠到上半屏幕时才上移
            let topCakeY = cakes[cakes.length-1].y;
            cameraY = topCakeY < 325 ? 325 - topCakeY : 0;
            lerpY += (cameraY - lerpY) * 0.1;
            
            ctx.save();
            ctx.translate(0, lerpY);
            // 绘制地基桌子
            ctx.fillStyle = "#efe5d9"; ctx.fillRect(0, 565, 400, 200); 
            cakes.forEach(drawCake); 
            if (moving) drawCake(moving);
            ctx.restore();
        } else {
            fryX = (fryX + 3) % 100; document.getElementById('fry-line').style.left = fryX + "%";
            ctx.font = "80px Arial"; ctx.fillText("🍟", 160, 320);
        }
    }
    requestAnimationFrame(loop);
}

canvas.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    if (!isGaming) return;
    if (currentMode === 'CAKE') {
        const last = cakes[cakes.length-1];
        const diff = moving.x - last.x;
        if (Math.abs(diff) >= last.w) { gold += score*35; closeGame(true); }
        else {
            const nw = last.w - Math.abs(diff);
            cakes.push({x: diff>0?moving.x:last.x, y:moving.y, w:nw, c:moving.c});
            score++; document.getElementById('score-val').innerText = score; spawnCake();
        }
    } else {
        if (fryX >= 70 && fryX <= 85) { gold += 80; closeGame(true); } else closeGame(false);
    }
});

function closeGame(win) {
    isGaming = false;
    justClosedGame = true; 
    interactArea.classList.add('no-click'); 
    
    setTimeout(() => { 
        justClosedGame = false; 
        interactArea.classList.remove('no-click'); 
    }, 500); 

    document.getElementById('game-ui').classList.add('hidden');
    document.getElementById('story-ui').classList.remove('hidden');
    document.getElementById('fry-bar').classList.add('hidden');
    if (win && activeCustID) removeCust(activeCustID);
    else if (activeCustID) makeAngry(activeCustID);
    updateGoldUI();
}
init(); loop();