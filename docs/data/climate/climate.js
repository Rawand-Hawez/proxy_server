// Climate KRD Dashboard
// Environmental Projects & Sustainability Initiatives

// ==========================================
// Climate KRD Project Data
// ==========================================

const CLIMATE_DATA = {
    projects: [
        {
            no: 1,
            project: "Recycle Bins",
            amount: 500,
            unit: "Bins",
            duration: "July - Aug",
            status: "Done",
            location: "Hawler & Duhok",
            partner: "Ministry of Municipality and Tourism",
            directBeneficiary: 15,
            indirectBeneficiary: 25000,
            environmentalOutcome: "8 ton/monthly plastics saved to be recycled that is 96 tons per year",
            brief: "Installing 350 in Hawler and 150 in Duhok for collecting the plastic and nylon waste to be recycled."
        },
        {
            no: 3,
            project: "Tote Bag",
            amount: 1100,
            unit: "Bags",
            duration: "June - Aug",
            status: "Done",
            location: "Kurdistan",
            partner: "Carrefour",
            directBeneficiary: 1100,
            indirectBeneficiary: 5500,
            environmentalOutcome: "Each Tote Bag can replace around 240 bags per year, that is 264,000 plastic/nylon bags reduced",
            brief: "Distribution of 1,100 bags to support community by reducing the plastic bags waste"
        },
        {
            no: 5,
            project: "Zhinga Dost",
            amount: 15,
            unit: "People",
            duration: "Aug - Dec",
            status: "In Progress",
            location: "Kurdistan",
            partner: "-",
            directBeneficiary: 12,
            indirectBeneficiary: 30000,
            environmentalOutcome: "Promoting cleaner, healthier, and more encouraged community by posting public awareness videos which include long-term environmental initiatives.",
            brief: "Exploring a Zhinga Dost hashtag for Kurdistan community to support environment by implementing an invitative. At the end of the project 15 Climate Ambassadors will be awarded."
        },
        {
            no: 7,
            project: "Zakho Conference",
            amount: 2,
            unit: "Days",
            duration: "July",
            status: "Done",
            location: "Zakho",
            partner: "Zakho Independent Administration",
            directBeneficiary: 220,
            indirectBeneficiary: 40000,
            environmentalOutcome: "Inhancing awarness of green urban solutions, support for increasing 1-2% in city, and highlighting key problems and solutions toward green city.",
            brief: "Organizing a two-day conference and training for 37 youth to spotlight key environmental issues and solutions toward becoming an eco-friendly city."
        },
        {
            no: 9,
            project: "Planting Future's Hope",
            amount: 500,
            unit: "Seeds",
            duration: "Feb - Apr",
            status: "Done",
            location: "Hawler",
            partner: "Hawler Medical University",
            directBeneficiary: 500,
            indirectBeneficiary: 1000,
            environmentalOutcome: "Capturing nearly 4 tCO2 per year through the project, raising awareness among students, and participating 500 students in the plantation method.",
            brief: "Distributing seed packets to university students in Hawler Medical University (HMU)."
        },
        {
            no: 10,
            project: "Ramadhan Bazar Donation",
            amount: 2000,
            unit: "Clothes pcs",
            duration: "Feb - Apr",
            status: "Done",
            location: "Hawler",
            partner: "-",
            directBeneficiary: 500,
            indirectBeneficiary: 2000,
            environmentalOutcome: "The booth prevented up to 1,000 kg of textile waste and saved approximately 5.4 million litres of water and 8 tons of CO₂ emissions.",
            brief: "Installing a booth to collect and donate clothes from the community and upcycle to foster sustainable solutions"
        },
        {
            no: 11,
            project: "Tree Donation",
            amount: 500,
            unit: "Trees",
            duration: "Feb - Apr",
            status: "Done",
            location: "Duhok",
            partner: "University of Duhok",
            directBeneficiary: 50,
            indirectBeneficiary: 1000,
            environmentalOutcome: "Capturing nearly 4 tCO2 per year through the project, raising awareness among students, and participating 500 students in the plantation method.",
            brief: "Donating trees to University of Duhok at the same day of opening the volunteer krd club"
        },
        {
            no: 12,
            project: "Eco-run - Earth Day Marathon",
            amount: 500,
            unit: "People",
            duration: "April",
            status: "Done",
            location: "Hawler",
            partner: "Hasar Organization",
            directBeneficiary: 1000,
            indirectBeneficiary: 1000,
            environmentalOutcome: "Raising awareness and inspire the community to adapt eco-friendly habits in daily life.",
            brief: "An eco-friendly running event implemented to raise environmental awareness and inspire sustainable living."
        },
        {
            no: 13,
            project: "Go Green Project",
            amount: 400,
            unit: "Trees",
            duration: "Feb - Apr",
            status: "Done",
            location: "Soran",
            partner: "Honor",
            directBeneficiary: 30,
            indirectBeneficiary: 800,
            environmentalOutcome: "Capturing nearly 3.2 tCO2 per year through the project, raising awareness among volunteers.",
            brief: "Initiating a tree planting initiative ahead of Earth Day in Soran City by planting 400 trees."
        }
    ]
};

// ==========================================
// Chart Instances
// ==========================================

let climateBeneficiariesChart = null;
let climateStatusChart = null;
let climateUnitsChart = null;

// ==========================================
// Data Processing Functions
// ==========================================

function getClimateKPIs() {
    const data = CLIMATE_DATA.projects;

    return {
        totalProjects: data.length,
        directBeneficiaries: data.reduce((sum, p) => sum + p.directBeneficiary, 0),
        indirectBeneficiaries: data.reduce((sum, p) => sum + p.indirectBeneficiary, 0),
        projectsByStatus: {
            done: data.filter(p => p.status === 'Done').length,
            inProgress: data.filter(p => p.status === 'In Progress').length
        }
    };
}

// ==========================================
// UI Update Functions
// ==========================================

function updateClimateMetrics() {
    const kpis = getClimateKPIs();

    document.getElementById('climate-total-projects').textContent = kpis.totalProjects;
    document.getElementById('climate-direct-beneficiaries').textContent = formatNumber(kpis.directBeneficiaries);
    document.getElementById('climate-indirect-beneficiaries').textContent = formatNumber(kpis.indirectBeneficiaries);
}

function renderClimateProjectsTable() {
    const tbody = document.querySelector('#climateProjectsTable tbody');
    tbody.innerHTML = '';

    CLIMATE_DATA.projects.forEach(project => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        // Status badge styling with slate palette
        const statusClass = project.status === 'Done'
            ? 'bg-slate-700 text-white'
            : 'bg-slate-200 text-slate-800';

        row.innerHTML = `
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${project.no}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">${project.project}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${formatNumber(project.amount)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${project.unit}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${project.duration}</td>
            <td class="px-4 py-3 whitespace-nowrap">
                <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                    ${project.status}
                </span>
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${project.location}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-600">${project.partner}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${formatNumber(project.directBeneficiary)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm text-gray-900">${formatNumber(project.indirectBeneficiary)}</td>
            <td class="px-4 py-3 text-sm text-gray-600" style="max-width: 300px;">${project.environmentalOutcome}</td>
            <td class="px-4 py-3 text-sm text-gray-600" style="max-width: 300px;">${project.brief}</td>
        `;

        tbody.appendChild(row);
    });
}

// ==========================================
// Chart Rendering Functions
// ==========================================

function renderClimateBeneficiariesChart() {
    const ctx = document.getElementById('climateBeneficiariesChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (climateBeneficiariesChart) {
        climateBeneficiariesChart.destroy();
    }

    const projects = CLIMATE_DATA.projects;
    const labels = projects.map(p => p.project);
    const directData = projects.map(p => p.directBeneficiary);
    const indirectData = projects.map(p => p.indirectBeneficiary);

    climateBeneficiariesChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Direct Beneficiaries',
                    data: directData,
                    backgroundColor: 'rgba(71, 85, 105, 0.85)',
                    borderColor: 'rgba(71, 85, 105, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Indirect Beneficiaries',
                    data: indirectData,
                    backgroundColor: 'rgba(148, 163, 184, 0.85)',
                    borderColor: 'rgba(148, 163, 184, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            }
        }
    });
}

function renderClimateStatusChart() {
    const ctx = document.getElementById('climateStatusChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (climateStatusChart) {
        climateStatusChart.destroy();
    }

    const kpis = getClimateKPIs();

    climateStatusChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Done', 'In Progress'],
            datasets: [{
                label: 'Number of Projects',
                data: [kpis.projectsByStatus.done, kpis.projectsByStatus.inProgress],
                backgroundColor: [
                    'rgba(51, 65, 85, 0.9)',
                    'rgba(100, 116, 139, 0.9)'
                ],
                borderColor: [
                    'rgba(51, 65, 85, 1)',
                    'rgba(100, 116, 139, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2,
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                }
            }
        }
    });
}

function renderClimateUnitsChart() {
    const ctx = document.getElementById('climateUnitsChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (climateUnitsChart) {
        climateUnitsChart.destroy();
    }

    const projects = CLIMATE_DATA.projects;
    const labels = projects.map(p => p.project);
    const amounts = projects.map(p => p.amount);

    climateUnitsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Amount / Units',
                data: amounts,
                backgroundColor: 'rgba(107, 114, 128, 0.85)',
                borderColor: 'rgba(107, 114, 128, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const project = projects[context.dataIndex];
                            return formatNumber(context.parsed.y) + ' ' + project.unit;
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// Main Load Function
// ==========================================

async function loadClimateData(forceRefresh = false) {
    try {
        // Update metrics
        updateClimateMetrics();

        // Render table
        renderClimateProjectsTable();

        // Render charts
        renderClimateBeneficiariesChart();
        renderClimateStatusChart();

        console.log('Climate KRD data loaded successfully');
    } catch (error) {
        console.error('Error loading Climate KRD data:', error);
        showError('Failed to load Climate KRD data. Please try again.');
    }
}
