import { API } from './api.js';

let allReservations = [];
let allServices = [];
let revChartInstance = null;
let resChartInstance = null;

const chartColors = {
    primary: '#061b0e',
    secondary: '#4d6452',
    tertiary: '#b4cdb8',
    cancelled: '#ba1a1a',
    pending: '#e3e2e0'
};

document.addEventListener('DOMContentLoaded', async () => {
    const startDateInput = document.getElementById('filterStartDate');
    const endDateInput = document.getElementById('filterEndDate');

    if (startDateInput && !startDateInput.value) startDateInput.value = '2026-08-01';
    if (endDateInput && !endDateInput.value) endDateInput.value = '2026-08-31';

    await loadData();

    const applyBtn = document.getElementById('btnApplyFilters');
    if (applyBtn) {
        applyBtn.addEventListener('click', updateDashboard);
    }
});

async function loadData() {
    try {
        const [resResponse, srvResponse] = await Promise.all([
            API.reservations.getAll(),
            API.services.getAll()
        ]);
        
        let rawRes = resResponse;
        if (resResponse && typeof resResponse === 'object' && !Array.isArray(resResponse)) {
            rawRes = resResponse.data || resResponse.reservations || [];
        }

        let rawSrv = srvResponse;
        if (srvResponse && typeof srvResponse === 'object' && !Array.isArray(srvResponse)) {
            rawSrv = srvResponse.data || srvResponse.services || [];
        }

        allReservations = Array.isArray(rawRes) ? rawRes : [];
        allServices = Array.isArray(rawSrv) ? rawSrv : [];
        
        updateDashboard();
    } catch (error) {
        console.error("Error loading statistics:", error);
    }
}

function updateDashboard() {
    const startVal = document.getElementById('filterStartDate')?.value;
    const endVal = document.getElementById('filterEndDate')?.value;

    const startDate = startVal ? new Date(startVal + 'T00:00:00') : new Date('2026-08-01T00:00:00');
    const endDate = endVal ? new Date(endVal + 'T23:59:59') : new Date('2026-08-31T23:59:59');

    const filteredReservations = allReservations.filter(res => {
        if (!res.service_date) return false;
        const resDate = new Date(res.service_date + 'T00:00:00');
        return resDate >= startDate && resDate <= endDate;
    });

    calculateKPIs(filteredReservations);
    calculateInsights(filteredReservations);
    updateCharts(filteredReservations);
    updateServiceTable(filteredReservations);
}

function getReservationValue(reservation) {
    const service = allServices.find(s => String(s.id) === String(reservation.service_id));
    if (service) {
        const price = Number(service.price_per_hour || service.price || 0);
        const duration = Number(service.estimated_duration_hours || service.duration || 1);
        return price * duration;
    }
    return Number(reservation.total_price || 0);
}

function calculateKPIs(reservations) {
    let totalRevenue = 0;
    let completedCount = 0;
    let cancelledCount = 0;

    reservations.forEach(res => {
        const status = (res.status || '').toUpperCase();
        if (status === 'COMPLETED') { 
            completedCount++;
            totalRevenue += getReservationValue(res);
        } else if (status === 'CANCELLED' || status === 'REJECTED') {
            cancelledCount++;
        }
    });

    const totalRes = reservations.length;
    const completedRate = totalRes > 0 ? ((completedCount / totalRes) * 100).toFixed(1) : 0;
    const cancelRate = totalRes > 0 ? ((cancelledCount / totalRes) * 100).toFixed(1) : 0;
    const avgRes = completedCount > 0 ? (totalRevenue / completedCount).toFixed(2) : 0;

    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText('kpiRevenue', `$${totalRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
    setText('kpiReservations', totalRes);
    setText('kpiConfirmed', completedCount);
    setText('kpiConfirmedRate', `${completedRate}% rate`);
    setText('kpiAvgRes', `$${avgRes}`);
    setText('kpiCancelRate', `${cancelRate}%`);
}

function calculateInsights(reservations) {
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    if (reservations.length === 0) {
        setText('insightMostBookedName', 'No data');
        setText('insightMostBookedCount', '0');
        setText('insightHighRevName', 'No data');
        setText('insightHighRevAmount', '$0.00');
        setText('insightBusiestDay', 'No data');
        setText('insightBusiestCount', '0');
        return;
    }

    const serviceStats = {};
    const dayStats = {};
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    reservations.forEach(res => {
        const status = (res.status || '').toUpperCase();
        if (status !== 'COMPLETED') return; 

        const sId = res.service_id;
        if (!sId) return;

        if (!serviceStats[sId]) {
            serviceStats[sId] = { count: 0, revenue: 0 };
        }
        serviceStats[sId].count++;
        serviceStats[sId].revenue += getReservationValue(res);

        if (res.service_date) {
            const dateObj = new Date(res.service_date + 'T00:00:00');
            const dayName = daysOfWeek[dateObj.getDay()];
            dayStats[dayName] = (dayStats[dayName] || 0) + 1;
        }
    });

    let mostBookedId = null;
    let maxCount = 0;
    let highRevId = null;
    let maxRev = 0;

    for (const [id, stats] of Object.entries(serviceStats)) {
        if (stats.count > maxCount) { maxCount = stats.count; mostBookedId = id; }
        if (stats.revenue > maxRev) { maxRev = stats.revenue; highRevId = id; }
    }

    const mostBookedService = allServices.find(s => String(s.id) === String(mostBookedId));
    const highRevService = allServices.find(s => String(s.id) === String(highRevId));

    let busiestDay = '-';
    let busiestCount = 0;
    for (const [day, count] of Object.entries(dayStats)) {
        if (count > busiestCount) { busiestCount = count; busiestDay = day; }
    }

    setText('insightMostBookedName', mostBookedService ? mostBookedService.name : 'Unknown');
    setText('insightMostBookedCount', maxCount);
    
    setText('insightHighRevName', highRevService ? highRevService.name : 'Unknown');
    setText('insightHighRevAmount', `$${maxRev.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
    
    setText('insightBusiestDay', busiestDay);
    setText('insightBusiestCount', busiestCount);
}

function updateCharts(reservations) {
    const dates = {};
    reservations.forEach(res => {
        const d = res.service_date;
        if (!d) return;

        if (!dates[d]) {
            dates[d] = { revenue: 0, completed: 0, pending: 0, cancelled: 0 };
        }
        
        const status = (res.status || '').toUpperCase();
        if (status === 'COMPLETED') {
            dates[d].completed++;
            dates[d].revenue += getReservationValue(res);
        } else if (status === 'PENDING') {
            dates[d].pending++;
        } else if (status === 'CANCELLED' || status === 'REJECTED') {
            dates[d].cancelled++;
        }
    });

    const sortedDates = Object.keys(dates).sort();
    const labels = sortedDates.map(d => d.substring(5));

    const revenueData = sortedDates.map(d => dates[d].revenue);
    const completedData = sortedDates.map(d => dates[d].completed);
    const pendingData = sortedDates.map(d => dates[d].pending);
    const cancelledData = sortedDates.map(d => dates[d].cancelled);

    const canvasRev = document.getElementById('revenueChart');
    if (canvasRev && window.Chart) {
        const ctxRev = canvasRev.getContext('2d');
        if (revChartInstance) revChartInstance.destroy();
        
        revChartInstance = new Chart(ctxRev, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue ($)',
                    data: revenueData,
                    borderColor: chartColors.primary,
                    backgroundColor: 'rgba(6, 27, 14, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    const canvasRes = document.getElementById('reservationsChart');
    if (canvasRes && window.Chart) {
        const ctxRes = canvasRes.getContext('2d');
        if (resChartInstance) resChartInstance.destroy();

        resChartInstance = new Chart(ctxRes, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Completed', data: completedData, backgroundColor: chartColors.primary },
                    { label: 'Pending', data: pendingData, backgroundColor: chartColors.tertiary },
                    { label: 'Cancelled', data: cancelledData, backgroundColor: chartColors.cancelled }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { x: { stacked: true }, y: { stacked: true } }
            }
        });
    }
}

function updateServiceTable(reservations) {
    const tbody = document.getElementById('servicePerformanceBody');
    if (!tbody) return;

    tbody.innerHTML = '';

    const stats = {};
    let grandTotalRevenue = 0;

    reservations.forEach(res => {
        const status = (res.status || '').toUpperCase();
        if (status !== 'COMPLETED') return;  

        const sId = res.service_id;
        if (!sId) return;

        if (!stats[sId]) stats[sId] = { id: sId, count: 0, revenue: 0 };
        
        stats[sId].count++;
        const val = getReservationValue(res);
        stats[sId].revenue += val;
        grandTotalRevenue += val;
    });

    const statsArray = Object.values(stats).sort((a, b) => b.revenue - a.revenue);

    if (statsArray.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-4 text-center text-secondary text-sm">No completed service data available for this date range.</td></tr>`;
        return;
    }

    statsArray.forEach((stat, index) => {
        const service = allServices.find(s => String(s.id) === String(stat.id));
        const serviceName = service ? service.name : 'Unknown Service';
        const avgValue = stat.count > 0 ? (stat.revenue / stat.count).toFixed(2) : '0.00';
        const revPercent = grandTotalRevenue > 0 ? ((stat.revenue / grandTotalRevenue) * 100).toFixed(1) : '0.0';

        const tr = document.createElement('tr');
        tr.className = index === 0 ? 'border-b border-outline-variant/10 bg-primary/5' : 'border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors';
        
        tr.innerHTML = `
            <td class="py-4 px-4 text-sm font-medium ${index > 0 ? 'text-secondary' : ''}">${index + 1}</td>
            <td class="py-4 px-4 text-sm ${index === 0 ? 'font-medium flex items-center gap-2' : ''}">
                ${index === 0 ? '<span class="w-2 h-2 rounded-full bg-[#061b0e]"></span>' : ''}${serviceName}
            </td>
            <td class="py-4 px-4 text-sm text-right ${index > 0 ? 'text-secondary' : ''}">${stat.count}</td>
            <td class="py-4 px-4 text-sm text-right ${index === 0 ? 'font-medium' : 'text-secondary'}">$${stat.revenue.toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
            <td class="py-4 px-4 text-sm text-right text-secondary">$${avgValue}</td>
            <td class="py-4 px-4 text-sm text-right text-secondary">${revPercent}%</td>
        `;
        tbody.appendChild(tr);
    });
}