import { database, auth } from "./firebase-config.js";
import { ref, onValue, set, push, get } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

let consumptionListener = null;

// Render the consumption dashboard
export function renderConsumptionDashboard() {
  const container = document.getElementById("app-container");
  container.innerHTML = `
    <div class="dashboard-container">
      <div class="dashboard-header">
        <h2>Electric Consumption Dashboard</h2>
        <p>Monitor your electricity usage and manage payments</p>
      </div>
      
      <div class="dashboard-grid">
        <!-- Current Consumption Card -->
        <div class="consumption-card card">
          <div class="card-header">
            <h3>Current Consumption</h3>
            <div class="status-indicator" id="connection-status">
              <span class="status-dot"></span>
              <span class="status-text">Connecting...</span>
            </div>
          </div>
          <div class="card-content">
            <div class="consumption-display">
              <div class="consumption-value" id="consumption-value">
                <span class="value">--</span>
                <span class="unit">kWh</span>
              </div>
              <div class="consumption-rate" id="consumption-rate">
                Rate: <span>--</span> ₱/kWh
              </div>
            </div>
            <div class="consumption-details">
              <div class="detail-item">
                <span class="label">Today's Usage:</span>
                <span class="value" id="today-usage">-- kWh</span>
              </div>
              <div class="detail-item">
                <span class="label">This Month:</span>
                <span class="value" id="month-usage">-- kWh</span>
              </div>
              <div class="detail-item">
                <span class="label">Last Updated:</span>
                <span class="value" id="last-updated">--</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Bill Summary Card -->
        <div class="bill-card card">
          <div class="card-header">
            <h3>Current Bill (Raw Amount)</h3>
          </div>
          <div class="card-content">
            <div class="bill-amount">
              <span class="currency">₱</span>
              <span class="amount" id="bill-amount">0.00</span>
            </div>
            <div class="bill-details">
              <div class="bill-item">
                <span>Total Amount (kWh × Price):</span>
                <span id="energy-charge">₱0.00</span>
              </div>
              <div class="bill-item">
                <span>Service Fee:</span>
                <span id="service-fee">₱0.00</span>
              </div>
              <div class="bill-item">
                <span>Tax:</span>
                <span id="tax-amount">₱0.00</span>
              </div>
            </div>
            <div class="payment-section">
              <button id="payment-btn" class="btn-payment">
                <span class="btn-text">Make Payment</span>
                <div class="btn-loading" style="display: none;">Processing...</div>
              </button>
              <div id="payment-message" class="payment-message"></div>
            </div>
          </div>
        </div>

        <!-- Usage History Card -->
        <div class="history-card card">
          <div class="card-header">
            <h3>Recent Usage History</h3>
          </div>
          <div class="card-content">
            <div class="history-list" id="usage-history">
              <div class="loading-history">Loading history...</div>
            </div>
          </div>
        </div>

        <!-- Quick Actions Card -->
        <div class="actions-card card">
          <div class="card-header">
            <h3>Quick Actions</h3>
          </div>
          <div class="card-content">
            <div class="action-buttons">
              <button class="action-btn" id="export-data-btn">
                Export Data
              </button>
              <button class="action-btn" id="set-alert-btn">
                Set Usage Alert
              </button>
              <button class="action-btn" id="view-trends-btn">
                View Trends
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Initialize dashboard functionality
  initializeDashboard();
}

// Initialize dashboard functionality
function initializeDashboard() {
  // Load consumption data
  loadConsumptionData();
  
  // Set up event listeners
  setupEventListeners();
  
  // Load usage history
  loadUsageHistory();
}

// Load consumption data from Firebase
function loadConsumptionData() {
  const consumptionRef = ref(database, "kwhrxprice");
  
  console.log("Loading consumption data from Firebase...");
  // Update connection status
  updateConnectionStatus("connecting");
  
  // Listen for real-time updates
  consumptionListener = onValue(consumptionRef, (snapshot) => {
    try {
      const data = snapshot.val();
      console.log("Received consumption data:", data);
      
      if (data !== null && data !== undefined) {
        updateConnectionStatus("connected");
        displayConsumptionData(data);
        calculateBill(data);
      } else {
        console.log("No consumption data available, setting default bill");
        updateConnectionStatus("no-data");
        displayNoData();
        // Set default bill for demo purposes
        setDefaultBill();
      }
    } catch (error) {
      console.error("Error processing consumption data:", error);
      updateConnectionStatus("error");
      displayError("Error loading consumption data");
    }
  }, (error) => {
    console.error("Error fetching consumption data:", error);
    updateConnectionStatus("error");
    displayError("Failed to connect to database");
    // Set default bill for demo purposes even on error
    setDefaultBill();
  });
}

// Display consumption data
function displayConsumptionData(data) {
  // Handle different data structures
  let consumption, rate, timestamp;
  
  if (typeof data === 'object' && data !== null) {
    consumption = data.kwh || data.consumption || data.value || 0;
    rate = data.price || data.rate || 12.50; // Default rate in PHP
    timestamp = data.timestamp || data.lastUpdated || Date.now();
  } else if (typeof data === 'number') {
    consumption = data;
    rate = 12.50; // Default rate in PHP
    timestamp = Date.now();
  } else {
    consumption = 0;
    rate = 12.50;
    timestamp = Date.now();
  }

  console.log("Displaying consumption data:", { consumption, rate, timestamp });

  // Update consumption display
  document.getElementById("consumption-value").innerHTML = `
    <span class="value">${consumption.toFixed(2)}</span>
    <span class="unit">kWh</span>
  `;
  
  document.getElementById("consumption-rate").innerHTML = `
    Rate: <span>₱${rate.toFixed(2)}</span> /kWh
  `;

  // Update usage details (simulated data for demo)
  document.getElementById("today-usage").textContent = `${(consumption * 0.8).toFixed(2)} kWh`;
  document.getElementById("month-usage").textContent = `${(consumption * 25).toFixed(2)} kWh`;
  document.getElementById("last-updated").textContent = new Date(timestamp).toLocaleString();

  // Store current data for bill calculation
  window.currentConsumptionData = { consumption, rate, timestamp };
}

// Calculate and display bill in PHP (Raw amount only: kWh × Price)
function calculateBill(data) {
  const consumption = typeof data === 'object' ? (data.kwh || data.consumption || data.value || 0) : (typeof data === 'number' ? data : 0);
  const rate = typeof data === 'object' ? (data.price || data.rate || 12.50) : 12.50;
  
  // Simple calculation: kWh × Price only (raw amount from Firebase)
  const rawAmount = consumption * rate;

  console.log("Calculating raw bill amount:", { consumption, rate, rawAmount });

  // Update bill display - show only the raw amount
  document.getElementById("bill-amount").textContent = rawAmount.toFixed(2);
  document.getElementById("energy-charge").textContent = `₱${rawAmount.toFixed(2)}`;
  document.getElementById("service-fee").textContent = `₱0.00`;
  document.getElementById("tax-amount").textContent = `₱0.00`;
}

// Set default bill for demo purposes
function setDefaultBill() {
  console.log("Setting default bill for demo");
  const defaultConsumption = 45.5;
  const defaultRate = 12.50;
  
  // Display default consumption
  document.getElementById("consumption-value").innerHTML = `
    <span class="value">${defaultConsumption.toFixed(2)}</span>
    <span class="unit">kWh</span>
  `;
  
  document.getElementById("consumption-rate").innerHTML = `
    Rate: <span>₱${defaultRate.toFixed(2)}</span> /kWh
  `;

  // Calculate and display default bill (raw amount only)
  const rawAmount = defaultConsumption * defaultRate;

  document.getElementById("bill-amount").textContent = rawAmount.toFixed(2);
  document.getElementById("energy-charge").textContent = `₱${rawAmount.toFixed(2)}`;
  document.getElementById("service-fee").textContent = `₱0.00`;
  document.getElementById("tax-amount").textContent = `₱0.00`;
  
  // Update usage details
  document.getElementById("today-usage").textContent = `${(defaultConsumption * 0.8).toFixed(2)} kWh`;
  document.getElementById("month-usage").textContent = `${(defaultConsumption * 25).toFixed(2)} kWh`;
  document.getElementById("last-updated").textContent = new Date().toLocaleString();
}

// Update connection status indicator
function updateConnectionStatus(status) {
  const statusElement = document.getElementById("connection-status");
  const statusDot = statusElement.querySelector(".status-dot");
  const statusText = statusElement.querySelector(".status-text");
  
  statusElement.className = `status-indicator ${status}`;
  
  switch (status) {
    case "connecting":
      statusText.textContent = "Connecting...";
      break;
    case "connected":
      statusText.textContent = "Live";
      break;
    case "no-data":
      statusText.textContent = "No Data";
      break;
    case "error":
      statusText.textContent = "Error";
      break;
  }
}

// Display no data message
function displayNoData() {
  document.getElementById("consumption-value").innerHTML = `
    <span class="value">--</span>
    <span class="unit">kWh</span>
  `;
  document.getElementById("consumption-rate").innerHTML = `Rate: <span>--</span> ₱/kWh`;
  document.getElementById("today-usage").textContent = "-- kWh";
  document.getElementById("month-usage").textContent = "-- kWh";
  document.getElementById("last-updated").textContent = "No data available";
}

// Display error message
function displayError(message) {
  document.getElementById("consumption-value").innerHTML = `
    <span class="value error">Error</span>
    <span class="unit"></span>
  `;
  console.error(message);
}

// Set up event listeners
function setupEventListeners() {
  // Payment button
  document.getElementById("payment-btn").addEventListener("click", processPayment);
  
  // Quick action buttons
  document.getElementById("export-data-btn").addEventListener("click", exportData);
  document.getElementById("set-alert-btn").addEventListener("click", setUsageAlert);
  document.getElementById("view-trends-btn").addEventListener("click", viewTrends);
}

// Process payment
async function processPayment() {
  const paymentBtn = document.getElementById("payment-btn");
  const btnText = paymentBtn.querySelector(".btn-text");
  const btnLoading = paymentBtn.querySelector(".btn-loading");
  const paymentMessage = document.getElementById("payment-message");
  
  // Show loading state
  btnText.style.display = "none";
  btnLoading.style.display = "inline";
  paymentBtn.disabled = true;
  paymentMessage.textContent = "";
  paymentMessage.className = "payment-message";

  try {
    // Get current bill amount
    const billAmount = document.getElementById("bill-amount").textContent;
    const billAmountFloat = parseFloat(billAmount);
    
    console.log("Processing payment for amount:", billAmount);
    
    // Validate payment amount
    if (!billAmount || billAmount === "0.00" || billAmountFloat <= 0) {
      throw new Error("No amount to pay or invalid amount");
    }

    // Get user confirmation
    const confirmPayment = confirm(`Are you sure you want to make a payment of ₱${billAmount}?`);
    if (!confirmPayment) {
      throw new Error("Payment cancelled by user");
    }

    // Simulate payment processing delay
    console.log("Simulating payment processing...");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Record payment in Firebase
    const user = auth.currentUser;
    if (!user) {
      throw new Error("User not authenticated. Please sign in again.");
    }

    const paymentData = {
      userId: user.uid,
      userEmail: user.email,
      amount: billAmountFloat,
      currency: "PHP",
      timestamp: Date.now(),
      date: new Date().toISOString(),
      status: "completed",
      paymentMethod: "credit_card", // Simulated
      transactionId: generateTransactionId(),
      description: "Electricity bill payment (Raw Amount)"
    };
    
    console.log("Recording payment in Firebase:", paymentData);
    const paymentsRef = ref(database, `payments/${user.uid}`);
    await push(paymentsRef, paymentData);
    
    // Show success message
    paymentMessage.textContent = `Payment of ₱${billAmount} processed successfully! Transaction ID: ${paymentData.transactionId}`;
    paymentMessage.className = "payment-message success";
    
    // Reset bill (simulate)
    setTimeout(() => {
      document.getElementById("bill-amount").textContent = "0.00";
      document.getElementById("energy-charge").textContent = "₱0.00";
      document.getElementById("service-fee").textContent = "₱0.00";
      document.getElementById("tax-amount").textContent = "₱0.00";
      
      // Show a brief confirmation
      showPaymentConfirmation();
    }, 1000);
    
  } catch (error) {
    console.error("Payment processing error:", error);
    
    if (error.message === "Payment cancelled by user") {
      paymentMessage.textContent = "Payment cancelled";
      paymentMessage.className = "payment-message";
    } else {
      paymentMessage.textContent = error.message || "Payment failed. Please try again.";
      paymentMessage.className = "payment-message error";
    }
  } finally {
    // Reset button state
    btnText.style.display = "inline";
    btnLoading.style.display = "none";
    paymentBtn.disabled = false;
  }
}

// Show payment confirmation notification
function showPaymentConfirmation() {
  const confirmationMsg = document.createElement("div");
  confirmationMsg.className = "payment-confirmation";
  confirmationMsg.textContent = "Bill has been reset to ₱0.00";
  confirmationMsg.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: rgba(76, 175, 80, 0.9);
    color: white;
    padding: 1rem;
    border-radius: 8px;
    z-index: 1000;
    animation: fadeIn 0.3s ease-in;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;
  document.body.appendChild(confirmationMsg);
  
  setTimeout(() => {
    confirmationMsg.remove();
  }, 3000);
}

// Load usage history
async function loadUsageHistory() {
  const historyContainer = document.getElementById("usage-history");
  
  try {
    // Simulate loading history data
    const historyData = generateMockHistory();
    
    historyContainer.innerHTML = historyData.map(item => `
      <div class="history-item">
        <div class="history-date">${item.date}</div>
        <div class="history-usage">${item.usage} kWh</div>
        <div class="history-cost">₱${item.cost}</div>
      </div>
    `).join('');
    
  } catch (error) {
    console.error("Error loading usage history:", error);
    historyContainer.innerHTML = '<div class="error">Failed to load history</div>';
  }
}

// Quick action functions
function exportData() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in to export data");
    return;
  }
  
  // Prepare CSV content
  const headers = ["Field", "Value"];
  const rows = [
    ["User Email", user.email],
    ["Export Date", new Date().toISOString()],
    ["Consumption (kWh)", document.getElementById("consumption-value").textContent],
    ["Bill Amount (₱)", document.getElementById("bill-amount").textContent],
    ["Today's Usage (kWh)", document.getElementById("today-usage").textContent],
    ["This Month's Usage (kWh)", document.getElementById("month-usage").textContent]
  ];
  
  let csvContent = headers.join(",") + "\n";
  rows.forEach(row => {
    csvContent += row.join(",") + "\n";
  });
  
  // Create a Blob and download link
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ElectriTrack_Consumption_${new Date().toISOString().slice(0,10)}.csv`);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  alert(`Data export completed for ${user.email}.`);
}

function setUsageAlert() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in to set usage alerts");
    return;
  }
  
  const threshold = prompt("Set usage alert threshold (kWh):");
  if (threshold && !isNaN(threshold) && parseFloat(threshold) > 0) {
    console.log(`Setting usage alert for user ${user.email}: ${threshold} kWh`);
    alert(`Usage alert set for ${threshold} kWh. You'll be notified when consumption exceeds this limit.`);
    
    // In a real app, this would be saved to Firebase
    const alertData = {
      userId: user.uid,
      threshold: parseFloat(threshold),
      timestamp: Date.now(),
      active: true
    };
    console.log("Alert data:", alertData);
  } else if (threshold !== null) {
    alert("Please enter a valid positive number for the threshold.");
  }
}

function viewTrends() {
  const user = auth.currentUser;
  if (!user) {
    alert("Please sign in to view trends");
    return;
  }
  
  console.log(`Loading trends for user: ${user.email}`);
  alert(`Trends analysis for ${user.email} would be displayed here. This feature shows consumption patterns over time.`);
}

// Utility functions
function generateTransactionId() {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

function generateMockHistory() {
  const history = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const usage = (Math.random() * 50 + 20).toFixed(2);
    const cost = (usage * 12.50).toFixed(2); // Using PHP rate
    
    history.push({
      date: date.toLocaleDateString(),
      usage: usage,
      cost: cost
    });
  }
  return history;
}

// Cleanup function
export function cleanupConsumptionListener() {
  if (consumptionListener) {
    consumptionListener();
    consumptionListener = null;
  }
}
