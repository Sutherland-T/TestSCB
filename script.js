// Connect to the WebSocket server
const websocket = new WebSocket('ws://127.0.0.1:8765');

// Flag to determine if the page has been initialized
let isInitialized = false;
let previousAthletesState = [];
let lastRaceClock = null;
let athletesTimeData = [];
let totalDistance = null;
let previousState = null;
let currentState = null;  // Add this line to keep track of the current state
let lastKnownState = null;

websocket.onmessage = function (event) {
    console.log('[DEBUG] Message event triggered');
    console.log('Received data:', event.data);

    let data;

    try {
        console.log('[DEBUG] Attempting to parse JSON data');
        data = JSON.parse(event.data);
        console.log('[DEBUG] Successfully parsed JSON data');
    } catch (e) {
        console.error("Error parsing JSON data:", e);
        return; // Exit the function if parsing fails
    }

    requestAnimationFrame(() => {
        console.log('[DEBUG] Inside requestAnimationFrame');
        
        if (data.hasOwnProperty('race_clock')) {
            console.log('[DEBUG] Data has property race_clock');

            // Update lastRaceClock regardless of state
            if (data.race_clock !== null) {
                console.log('[DEBUG] Setting lastRaceClock to received race_clock value');
                lastRaceClock = data.race_clock;
            }

            // Update the DOM
            console.log('[DEBUG] Updating the DOM');
            const raceClockElement = document.getElementById('raceClock');
            raceClockElement.textContent = lastRaceClock !== null ? lastRaceClock : "0.0";

            // Optional: If you still want to use state for setting class, you can do so here
            if (data.hasOwnProperty('state') && data.state !== null) {
                raceClockElement.className = `raceClock-${data.state}`;
            }
        }

        // Call initializeOrUpdateContent to update the content including the table
        console.log('[DEBUG] Calling initializeOrUpdateContent to update content');
        initializeOrUpdateContent(data);
    });
};

function initializeOrUpdateContent(data) {
    console.debug("[DEBUG] Inside initializeOrUpdateContent function");
    console.debug("[DEBUG] Data received:", JSON.stringify(data));

    // Check if essential data exists
    if (!data || !data.state) {
         console.warn("[WARNING] Essential data missing. Exiting function.");
         return;
    }

    const container = document.getElementById('content');

    if (container) {
        console.debug("[DEBUG] Found container element");
    } else {
        console.warn("[WARNING] Container element not found");
    }

    document.body.className = data.state;
    console.debug("[DEBUG] Setting document body class to:", data.state);

    // Determine the state title
    let stateTitleContent = "";
    switch (data.state) {
        case 'startlist':
            stateTitleContent = "Start list";
            break;
        case 'in_progress':
            stateTitleContent = "In progress...";
            break;
        case 'results':
            stateTitleContent = "Results";
            break;
        case 'clear':
            stateTitleContent = ""; // No title for the clear state
            break;
    }

    // Create or update the title only if it's not an empty string
    if (stateTitleContent !== "") {
        createOrUpdateElement('stateTitle', 'h1', stateTitleContent, container);
    }

    // Create or update the event
    if (data.event) {
        const eventContent = `${data.event.gender} ${data.event.distance}m ${data.event.stroke}`;
        createOrUpdateElement('event', 'h2', eventContent, container);
        document.getElementById('event').className = 'event-class';  // Assign a unique class
    }

    // Create or update the subtitle
    if (data.subtitle) {
        const subtitleContent = `Ev: ${data.subtitle.event_number} | Ht: ${data.subtitle.heat}`;
        createOrUpdateElement('subtitle', 'h2', subtitleContent, container);
        document.getElementById('subtitle').className = 'subtitle-class';  // Assign a unique class
    }

    // Create or update the athletes table
    createOrUpdateAthletesTable(data, laneOrder);
    totalDistance = data.event && data.event.distance;

    // Wrap elements in wrapper
    wrapElementsInWrapper();
}

function createOrUpdateElement(id, tag, content, container) {
    if (!container) {
        console.warn('Container is undefined for id:', id);
        return;
    }

    let element = document.getElementById(id);
    if (!element) {
        element = document.createElement(tag);
        element.id = id;
        element.className = `custom-${id}`;  // Add a class based on the id
        container.appendChild(element);
    }
    element.textContent = content;
}

function createOrUpdateAthletesTable(data, laneOrder) {
    // Check if athletes data is present; if not, return
    if (!data.athletes && data.state !== 'clear') return;

    const container = document.getElementById('content');
    let table = document.getElementById('athletesTable');

    // Create table if not exists
    if (!table) {
        table = document.createElement('table');
        table.id = 'athletesTable';
        container.appendChild(table);
    }

    // Define column titles based on state
    let columns;
    let columnMapping = {};
    switch (data.state) {
        case 'startlist':
            columns = ['Lane', 'Name', 'Team'];
            columnMapping = {'Lane': 'lane', 'Name': 'name', 'Team': 'team'};
            break;
        case 'in_progress':
            columns = ['L', 'Name', 'Time', 'P'];
            columnMapping = {'L': 'lane', 'Name': 'name', 'Time': 'time', 'P': 'place'};
            break;
        case 'results':
            columns = ['Place', 'Name', 'Team', 'Time', 'Lane'];
            columnMapping = {'Place': 'place', 'Name': 'name', 'Team': 'team', 'Time': 'time', 'Lane': 'lane'};
            break;
        default:
            columns = [];
            break;
    }

    // Create or update header
    const thead = table.tHead || table.createTHead();
    const headerRow = thead.rows[0] || thead.insertRow(0);
    // Remove existing header cells
    while (headerRow.firstChild) {
        headerRow.removeChild(headerRow.firstChild);
    }

    // Add new header cells
    columns.forEach(title => {
        const headerCell = document.createElement("th");
        headerCell.textContent = title;

        // Use the mapping if available
        const mappedKey = columnMapping[title] || title;
        
        // Add a class name based on the mappedKey (lowercased)
        headerCell.className = `column-${mappedKey.toLowerCase()}`;
        
        headerRow.appendChild(headerCell);
    });

    // Create or update body
    const tbody = table.tBodies[0] || table.createTBody();

    // Clear table body if state is 'clear'
    if (data.state === 'clear') {
        tbody.innerHTML = ''; // Clear existing rows
        return; // Exit the function after clearing the table
    }

    // Sort athletes by lane order if laneOrder is provided and valid
    if (data.athletes && ['startlist', 'in_progress'].includes(data.state)) {
        data.athletes.sort((a, b) => {
            // Assuming 'lane' is a numeric field in your athlete data
            if (laneOrder === 'ascending') {
                return a.lane - b.lane;
            } else if (laneOrder === 'descending') {
                return b.lane - a.lane;
            }
            return 0; // No sorting if laneOrder is not set correctly
        });
    }

    // Iterate through athletes data and populate table
    data.athletes.forEach((athlete, index) => {
        if (athlete === null) return; // Skip null athletes

        const row = tbody.rows[index] || tbody.insertRow(index);
        row.id = 'athlete-' + index;

        // Remove existing cells
        while (row.firstChild) {
            row.removeChild(row.firstChild);
        }

        columns.forEach((key, cellIndex) => {
            const cell = row.insertCell(cellIndex);
            const mappedKey = columnMapping[key] || key;
            let value = athlete[mappedKey.toLowerCase()] !== null ? athlete[mappedKey.toLowerCase()] : "";
        
            // cell.innerHTML is directly set to the value without any prefixes
            cell.innerHTML = value;
        
            // Add a class name based on the mapped key (lowercased)
            const className = mappedKey.startsWith('column-') ? mappedKey : `column-${mappedKey.toLowerCase()}`;
            cell.className = className;
        
            // Add or remove specific classes based on the presence of data
            if (value !== "") {
                cell.classList.add('cell-with-variable');
                cell.classList.remove('cell-without-variable');
            } else {
                cell.classList.add('cell-without-variable');
                cell.classList.remove('cell-with-variable');
            }
        });
    });
}

function wrapElementsInWrapper() {
    const container = document.getElementById('content');

    // Create the wrapper element
    let wrapper = document.getElementById('event-wrapper');
    if (!wrapper) {
        wrapper = document.createElement('div');
        wrapper.id = 'event-wrapper';
        wrapper.className = 'event-wrapper';
    }

    // Get the elements that need to be wrapped
    const eventElement = document.getElementById('event');
    const subtitleElement = document.getElementById('subtitle');
    const athletesTable = document.getElementById('athletesTable');

    // Append elements to wrapper
    if (eventElement) wrapper.appendChild(eventElement);
    if (subtitleElement) wrapper.appendChild(subtitleElement);
    if (athletesTable) wrapper.appendChild(athletesTable);

    // Append wrapper to container
    container.appendChild(wrapper);
}

function convertTimeToSeconds(timeString) {
    const timeParts = timeString.split(':');
    let seconds = 0;

    if (timeParts.length === 3) {
        seconds += parseFloat(timeParts[0]) * 60 * 60; // hours
        seconds += parseFloat(timeParts[1]) * 60;      // minutes
        seconds += parseFloat(timeParts[2]);            // seconds
    } else if (timeParts.length === 2) {
        seconds += parseFloat(timeParts[0]) * 60;       // minutes
        seconds += parseFloat(timeParts[1]);             // seconds
    } else if (timeParts.length === 1) {
        seconds += parseFloat(timeParts[0]);             // seconds
    }

    return seconds;
}

function formatTime(timeInSeconds) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = (timeInSeconds % 60).toFixed(2);
    return minutes > 0 ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(5, '0')}` : `${seconds}`;
}

// Utility function to format the 'athletes' array as a string
function formatAthletes(athletes) {
    return athletes.map((athlete, index) => {
        return `Athlete ${index + 1}: Name: ${athlete.name}, Time: ${athlete.time}, Team: ${athlete.team}, Place: ${athlete.place}`;
    }).join('\n');
}

// Utility function to update an element's text content if it has changed
function updateElementIfChanged(key, newValue) {
    // Check if the element exists
    const element = document.getElementById(key);
    if (!element) return; // If the element does not exist, exit the function

    if (key === 'athletes') {
        newValue.forEach((athlete, index) => {
            if (!athlete) {
                console.warn(`Athlete at index ${index} is null`);
                return; // Skip this iteration
            }

            const prevAthlete = previousAthletesState[index] || {};
            if (JSON.stringify(athlete) !== JSON.stringify(prevAthlete)) {
                // Update the athlete's content if anything has changed
                document.getElementById('athlete-' + index).textContent =
                    formatAthlete(athlete); // Using formatAthlete function
            }
        });
        // Update the previous state of athletes
        previousAthletesState = newValue.slice();
    } else {
        const formattedValue = formatValue(newValue);
        if (element.textContent !== formattedValue) {
            element.textContent = formattedValue;
        }
    }
}

// Utility function to format the value, converting objects to JSON strings
function formatValue(value, key) {
    if (typeof value === 'object') {
        if (key === 'event') {
            return `${value.gender} ${value.distance}m ${value.stroke}`;
        }
        if (key === 'subtitle') {
            return `Event: ${value.event_number} Heat: ${value.heat}`;
        }
        if (Array.isArray(value) && value[0] && typeof value[0] === 'object') {
            return value.map(formatAthlete).join('');
        }
        return JSON.stringify(value, null, 2);
    }
    return value;
}

// Function to format athlete object
function formatAthlete(athlete) {
    return `Lane: ${athlete.lane || ""}, Name: ${athlete.name || ""}, Time: ${athlete.time || ""}, Team: ${athlete.team || ""}, Place: ${athlete.place || ""}`;
}
