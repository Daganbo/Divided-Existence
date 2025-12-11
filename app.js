/**
 * Sanctuary City Simulation Code
 * Handles dual-role logic, resource management, and narrative events.
 */

// --- Game State & Configuration ---
const STATE = {
    role: null, // 'denizen' | 'occupier'
    location: 'portland', // 'portland' | 'newyork'
    day: 1,
    resources: {},
    history: [],
    gameOver: false
};

const ROLES = {
    denizen: {
        name: 'The Denizen',
        stats: {
            hunger: { val: 20, max: 100, label: 'Hunger (Low is Good)' }, // 0 = full, 100 = starving
            suspicion: { val: 0, max: 100, label: 'Suspicion' },
            health: { val: 100, max: 100, label: 'Health' },
            supplies: { val: 5, max: 50, label: 'Supplies' }
        },
        themeClass: 'mode-denizen'
    },
    occupier: {
        name: 'The Occupier',
        stats: {
            control: { val: 80, max: 100, label: 'City Control' },
            resources: { val: 100, max: 500, label: 'Rations Stock' },
            unrest: { val: 20, max: 100, label: 'Civil Unrest' },
            manpower: { val: 50, max: 100, label: 'Patrol Strength' }
        },
        themeClass: 'mode-occupier'
    }
};

// --- DOM Elements ---
const dom = {
    menu: document.getElementById('main-menu'),
    dashboard: document.getElementById('game-dashboard'),
    btnDenizen: document.getElementById('btn-denizen'),
    btnOccupier: document.getElementById('btn-occupier'),
    locBtns: document.querySelectorAll('.loc-btn'),
    statsContainer: document.getElementById('stats-container'),
    actionContainer: document.getElementById('action-container'),
    narrativeLog: document.getElementById('narrative-log'),
    dayCounter: document.getElementById('day-counter'),
    app: document.getElementById('app')
};

// --- Initialization ---
function init() {
    dom.btnDenizen.addEventListener('click', () => startGame('denizen'));
    dom.btnOccupier.addEventListener('click', () => startGame('occupier'));

    // Location Toggles
    dom.locBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            dom.locBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            STATE.location = e.target.getAttribute('data-loc');
        });
    });
}

function startGame(role) {
    STATE.role = role;
    STATE.day = 1;
    STATE.gameOver = false;

    // Deep copy stats to avoid mutating the config
    STATE.resources = JSON.parse(JSON.stringify(ROLES[role].stats));

    // Update UI
    dom.menu.classList.remove('active');
    dom.menu.classList.add('hidden');
    dom.dashboard.classList.remove('hidden');
    dom.dashboard.classList.add('active');
    dom.app.classList.add(ROLES[role].themeClass);

    renderStats();
    generateDailyEvent();
}

// --- Core Game Loop ---
function nextDay() {
    if (STATE.gameOver) return;

    STATE.day++;
    dom.dayCounter.textContent = STATE.day;

    // Passive Stat Changes
    applyPassiveEffects();

    // Check Win/Loss
    if (checkGameOver()) return;

    renderStats();
    generateDailyEvent();
}

function applyPassiveEffects() {
    if (STATE.role === 'denizen') {
        STATE.resources.hunger.val = Math.min(100, STATE.resources.hunger.val + 10);
        STATE.resources.suspicion.val = Math.max(0, STATE.resources.suspicion.val - 5);

        if (STATE.resources.hunger.val >= 90) {
            log("You are starving...", "warning");
            STATE.resources.health.val -= 10;
        }
    } else {
        // Occupier effects
        STATE.resources.unrest.val = Math.min(100, STATE.resources.unrest.val + 5); // Natural unrest growth
        STATE.resources.resources.val -= 5; // Daily consumption
    }
}

// --- Event System ---
function generateDailyEvent() {
    clearActions();

    let event;

    // Special Scripted Events
    if (STATE.day === 1 && STATE.role === 'denizen') {
        const eventTemplate = { ...MIDTOWN_ESCAPE_EVENT }; // Shallow copy to avoid permanent mutation

        if (STATE.location === 'newyork') {
            eventTemplate.title = "Manhattan Under Siege";
        } else {
            eventTemplate.title = "Downtown Under Siege";
        }
        event = eventTemplate;
    } else {
        event = getEventForRole(STATE.role);
    }

    // Render logic
    const sceneContainer = document.getElementById('scene-container');
    if (event.image) {
        sceneContainer.innerHTML = `<img src="${event.image}" alt="Scene Visual" class="event-image">`;
        sceneContainer.classList.remove('hidden');
    } else {
        sceneContainer.innerHTML = '<div class="mood-light"></div>';
    }

    log(`Day ${STATE.day}: ${event.title}`);
    log(event.description);

    event.choices.forEach(choice => {
        createActionButton(choice.label, () => resolveChoice(choice));
    });
}

function resolveChoice(choice) {
    // Apply costs/effects
    const roleStats = STATE.resources;

    for (const [stat, change] of Object.entries(choice.effects)) {
        if (roleStats[stat]) {
            roleStats[stat].val += change;
            // Clamp values
            roleStats[stat].val = Math.max(0, Math.min(roleStats[stat].max, roleStats[stat].val));
        }
    }

    log(`> ${choice.label}`, 'choice');
    log(choice.outcome);
    renderStats();

    if (!checkGameOver()) {
        createActionButton("End Day", nextDay);
    }
}

// --- Scenario Content ---
function getEventForRole(role) {
    // Determine pool based on role and perhaps stats
    const pool = role === 'denizen' ? DENIZEN_EVENTS : OCCUPIER_EVENTS;
    // Simple random for now
    return pool[Math.floor(Math.random() * pool.length)];
}

const MIDTOWN_ESCAPE_EVENT = {
    title: "Midtown Under Siege",
    description: "You are a mid-level corporate analyst for OmniCorp. The morning coffee is still warm on your desk when the first explosion shatters the glass. Looking out from the 40th floor, you see a rocket impact the adjacent tower. The invasion has begun. You have split seconds to react.",
    image: "midtown_attack.jpg",
    choices: [
        {
            label: "Grab Emergency Kit & Stairs",
            outcome: "You knew this day might come. You grab your 'go-bag' from under the desk and hit the fire stairs. You preserve your health but leave suspicious.",
            effects: { suspicion: 10, health: 0, supplies: 10 }
        },
        {
            label: "Download Data & Run",
            outcome: "This data could be valuable leverage. You secure the drive but inhale smoke on the way out.",
            effects: { suspicion: 0, health: -10, supplies: 0 } // Trade health for potential future value (not yet implemented, but narrative flavor)
        },
        {
            label: "Help Coworkers",
            outcome: "You stop to kelp Karen from HR. It slows you down, and you witness horrors you can't unsee.",
            effects: { morale: -20, health: -5, suspicion: -5 } // Helping reduces suspicion but hurts morale (if we had it, mapped to health for now)
        }
    ]
};

const DENIZEN_EVENTS = [
    {
        title: "A Knock at the Door",
        description: "Controls are tightening. Neighbors say patrols are checking random houses for contraband.",
        choices: [
            {
                label: "Hide Supplies",
                outcome: "You hid your meager supplies under the floorboards. Safe, but you're exhausted.",
                effects: { suspicion: -10, hunger: 5, supplies: 0 }
            },
            {
                label: "Bribe Patrol",
                outcome: "You gave them some food. They left you alone, for now.",
                effects: { suspicion: -20, supplies: -2 }
            },
            {
                label: "Do Nothing",
                outcome: "You sat in silence. They walked past.",
                effects: { suspicion: 5 } // Risky
            }
        ]
    },
    {
        title: "The Market Leak",
        description: "A truck carrying rations crashed nearby. People are swarming.",
        choices: [
            {
                label: "Join the crowd",
                outcome: "You managed to grab a box, but got bruised in the chaos.",
                effects: { supplies: 5, health: -5, suspicion: 10 }
            },
            {
                label: "Stay away",
                outcome: "Too dangerous. You come home empty handed.",
                effects: { hunger: 5 }
            }
        ]
    },
    {
        title: "Curfew Violation",
        description: "You are caught outside just as the sirens wail.",
        choices: [
            {
                label: "Run",
                outcome: "You dart down an alleyway. Heart pounding.",
                effects: { suspicion: 20, hunger: 5 }
            },
            {
                label: "Hide in dumpster",
                outcome: "It smells awful, but they didn't see you.",
                effects: { health: -5, suspicion: -5 }
            }
        ]
    }
];

const OCCUPIER_EVENTS = [
    {
        title: "Food Riots",
        description: "Citizens in Sector 4 are protesting the rationing.",
        choices: [
            {
                label: "Crackdown",
                outcome: "You sent in the riot squad. Order restored, but they hate you.",
                effects: { control: 10, unrest: 10, manpower: -5 }
            },
            {
                label: "Distribute Extra Rations",
                outcome: "The crowd disperses peacefully. Supplies are low.",
                effects: { unrest: -10, resources: -20 }
            }
        ]
    },
    {
        title: "The Informant",
        description: "A local offers information on the resistance leader in exchange for medicine.",
        choices: [
            {
                label: "Accept Deal",
                outcome: "The info was good. We made several arrests.",
                effects: { control: 15, resources: -10 }
            },
            {
                label: "Ignore",
                outcome: "Likely a trap or beggar. You ignore them.",
                effects: { control: -5 }
            }
        ]
    }
];

// --- UI Helpers ---
function log(msg, type = 'normal') {
    const p = document.createElement('p');
    p.textContent = msg;
    p.className = `log-entry ${type} new`;
    dom.narrativeLog.prepend(p);
}

function renderStats() {
    dom.statsContainer.innerHTML = '';
    for (const [key, stat] of Object.entries(STATE.resources)) {
        const div = document.createElement('div');
        div.className = 'stat-item';
        div.innerHTML = `
            <span class="stat-label">${stat.label}</span>
            <span class="stat-value">${stat.val} / ${stat.max}</span>
        `;
        dom.statsContainer.appendChild(div);
    }
}

function createActionButton(text, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.className = 'action-btn';
    btn.onclick = () => {
        // Disable sibling buttons to prevent multi-choice
        Array.from(dom.actionContainer.children).forEach(b => b.disabled = true);
        onClick();
    };
    dom.actionContainer.appendChild(btn);
}

function clearActions() {
    dom.actionContainer.innerHTML = '';
}

function checkGameOver() {
    if (STATE.role === 'denizen') {
        if (STATE.resources.health.val <= 0) {
            endGame("You succumbed to your injuries. The city claimed another soul.");
            return true;
        }
        if (STATE.resources.suspicion.val >= 100) {
            endGame("The secret police kicked down your door. You were never seen again.");
            return true;
        }
        if (STATE.resources.hunger.val >= 100) {
            endGame("Starvation has taken you.");
            return true;
        }
    } else {
        if (STATE.resources.control.val <= 0) {
            endGame("The city has fallen to the rebellion. You are forced to flee.");
            return true;
        }
        if (STATE.resources.unrest.val >= 100) {
            endGame("A massive uprising has overthrown your command center.");
            return true;
        }
    }
    return false;
}

function endGame(reason) {
    STATE.gameOver = true;
    log("GAME OVER", "warning");
    log(reason, "warning");
    clearActions();
    createActionButton("Return to Menu", () => window.location.reload());
}

// Start
init();
