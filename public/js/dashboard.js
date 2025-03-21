let salesLineChart, stockBarChart, categoryPieChart;

async function fetchChartData() {
  const filter = document.getElementById("chartFilter").value;
  let url = `/admin/sales-data?filter=${filter}`;

  // For predefined filters, granularity matches the filter type
  let granularity = filter === "custom" ? document.getElementById("granularity").value : filter;

  // If custom range is selected, append start and end dates
  if (filter === "custom") {
    const startDate = document.getElementById("startDate").value;
    const endDate = document.getElementById("endDate").value;
    if (!startDate || !endDate) {
      Swal.fire({
        icon: "warning",
        title: "Missing Dates",
        text: "Please select both start and end dates for a custom report.",
      });
      return;
    }
    url += `&startDate=${startDate}&endDate=${endDate}&granularity=${granularity}`;
  } else {
    url += `&granularity=${granularity}`;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Failed to fetch chart data");
    const data = await response.json();

console.log("Top Products:", data.topProducts);

    // Log data to verify
    console.log("Sales Data:", data.salesOverTime.salesData);
    console.log("Labels:", data.salesOverTime.labels);

    // Destroy existing charts
    if (salesLineChart) salesLineChart.destroy();
    if (stockBarChart) stockBarChart.destroy();
    if (categoryPieChart) categoryPieChart.destroy();

    // Sales Line Chart
    salesLineChart = new Chart(document.getElementById("salesLineChart").getContext("2d"), {
      type: "line",
      data: {
        labels: data.salesOverTime.labels,
        datasets: [{
          label: "Sales (₹)",
          data: data.salesOverTime.salesData,
          borderColor: "#ff7700",
          backgroundColor: "rgba(255, 119, 0, 0.2)",
          fill: true,
          tension: 0.1,
          pointRadius: 4,
          pointBackgroundColor: "#ff7700",
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Amount (₹)" } },
          x: { title: { display: true, text: "Period" } },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: { label: (context) => `Sales: ₹${context.raw.toFixed(2)}` },
          },
          legend: { display: true, position: "top" },
        },
      },
    });

    // Stock Bar Chart
    stockBarChart = new Chart(document.getElementById("stockBarChart").getContext("2d"), {
      type: "bar",
      data: {
        labels: data.salesOverTime.labels,
        datasets: [{
          label: "Stock Sold (Units)",
          data: data.salesOverTime.stockData,
          backgroundColor: "#3498db",
          borderColor: "#2980b9",
          borderWidth: 1,
        }],
      },
      options: {
        responsive: true,
        scales: {
          y: { beginAtZero: true, title: { display: true, text: "Units Sold" } },
          x: { title: { display: true, text: "Period" } },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: { label: (context) => `Stock Sold: ${context.raw} units` },
          },
          legend: { display: true, position: "top" },
        },
      },
    });

    // Top Categories Pie Chart
    categoryPieChart = new Chart(document.getElementById("categoryPieChart").getContext("2d"), {
      type: "pie",
      data: {
        labels: data.topCategories.map((c) => c.name),
        datasets: [{
          data: data.topCategories.map((c) => c.totalSales),
          backgroundColor: ["#ff7700", "#3498db", "#2ecc71", "#e74c3c", "#9b59b6"],
        }],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "top" },
          tooltip: { callbacks: { label: (context) => `${context.label}: ₹${context.raw.toFixed(2)}` } },
        },
      },
    });

    // Update Top Products List with Images
    const topProductsList = document.getElementById("topProducts");
   topProductsList.innerHTML = data.topProducts
  .map((p) => `
    <li>
      <img src="/uploads/${(p.image || 'default-image.jpg').replace(/^uploads\/?\/?/, '')}" alt="${p.name}">
      <div class="product-info">
        ${p.name} - ₹${p.totalSales.toFixed(2)} (${p.totalQuantity} units)
      </div>
    </li>
  `)
      .join("");
  } catch (error) {
    console.error("Error fetching chart data:", error);
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: "Failed to load dashboard data. Please try again later.",
      });
    }
  }
}

// Load when DOM is ready
document.addEventListener("DOMContentLoaded", fetchChartData);