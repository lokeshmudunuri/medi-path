import type { 
  QueuePredictionInput, 
  QueuePredictionOutput, 
  QueuePredictionProvider 
} from '../types/queue';

/**
 * DeterministicQueuePredictionProvider
 * 
 * Implements a transparent, deterministic mathematical queue prediction model:
 * - Computes weighted average of recent patient consultation durations (giving 60% weight to recent 3 patients).
 * - Multiplies by active waiting patients ahead.
 * - Adjusts for doctor operational status (DELAYED +10 min, BREAK +expected break, EMERGENCY +25 min).
 * - Adjusts for no-show probability and walk-in overhead.
 * - Produces an honest time range ("17:20–17:35") rather than falsely precise clock times.
 * - Calculates recommended arrival time with a 15-minute preparation buffer.
 */
export class DeterministicQueuePredictionProvider implements QueuePredictionProvider {
  public id = 'deterministic-opd-predictor-v1';
  public name = 'Deterministic OPD Queue Predictor';

  public predictWaitTime(input: QueuePredictionInput): QueuePredictionOutput {
    const {
      patientToken,
      patientsAhead,
      recentConsultationTimes,
      averageConsultationMinutes,
      doctorStatus,
      expectedBreakMinutes = 0,
      noShowRate = 0.08, // 8% baseline historical no-show rate
      walkInCount = 0,
      currentTime = new Date(),
    } = input;

    // 1. Calculate effective pace per patient
    let effectiveServiceMinutes = averageConsultationMinutes || 7;
    if (recentConsultationTimes && recentConsultationTimes.length > 0) {
      const recent = recentConsultationTimes.slice(-3);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      // 65% weight on recent velocity, 35% on baseline doctor average
      effectiveServiceMinutes = recentAvg * 0.65 + averageConsultationMinutes * 0.35;
    }

    // 2. Adjust for active patients ahead (accounting for potential no-shows and walk-ins)
    const activePatientsAhead = Math.max(0, patientsAhead);
    const expectedServingCount = activePatientsAhead * (1 - noShowRate) + (walkInCount * 0.5);
    
    let baseWaitMinutes = expectedServingCount * effectiveServiceMinutes;

    // 3. Status adjustments
    if (doctorStatus === 'DELAYED') {
      baseWaitMinutes += 12;
    } else if (doctorStatus === 'BREAK') {
      baseWaitMinutes += (expectedBreakMinutes || 20);
    } else if (doctorStatus === 'EMERGENCY') {
      baseWaitMinutes += 30;
    } else if (doctorStatus === 'OFFLINE') {
      baseWaitMinutes += 45;
    }

    // 4. Calculate honest min/max variance window
    // Variance grows with the number of patients ahead
    const varianceRatio = Math.min(0.35, 0.12 + (activePatientsAhead * 0.015));
    const minWaitMinutes = Math.max(0, Math.round(baseWaitMinutes * (1 - varianceRatio)));
    const maxWaitMinutes = Math.max(minWaitMinutes + 5, Math.round(baseWaitMinutes * (1 + varianceRatio)));
    const estimatedWaitMinutes = Math.round((minWaitMinutes + maxWaitMinutes) / 2);

    // 5. Format clock windows (e.g. "17:20–17:35")
    const formatTime = (date: Date) => {
      let hours = date.getHours();
      let minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const strMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
      return `${hours}:${strMinutes} ${ampm}`;
    };

    const startWindowDate = new Date(currentTime.getTime() + minWaitMinutes * 60000);
    const endWindowDate = new Date(currentTime.getTime() + maxWaitMinutes * 60000);
    const estimatedConsultationStart = `${formatTime(startWindowDate)}–${formatTime(endWindowDate)}`;

    // Recommended arrival: 15 minutes before the earliest window (or now if wait < 15 min)
    const arrivalBufferMin = Math.min(15, minWaitMinutes);
    const arrivalDate = new Date(startWindowDate.getTime() - arrivalBufferMin * 60000);
    const recommendedArrivalTime = formatTime(arrivalDate);

    // Confidence level: HIGH (few ahead), MEDIUM (moderate), LOW (high backlog or emergency)
    const confidence = Math.max(0.6, Number((0.95 - (activePatientsAhead * 0.02)).toFixed(2)));
    let confidenceLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'HIGH';
    if (activePatientsAhead > 15 || doctorStatus === 'EMERGENCY' || doctorStatus === 'OFFLINE') {
      confidenceLevel = 'LOW';
    } else if (activePatientsAhead > 7 || doctorStatus === 'DELAYED' || doctorStatus === 'BREAK') {
      confidenceLevel = 'MEDIUM';
    }

    return {
      estimatedWaitMinutes,
      minWaitMinutes,
      maxWaitMinutes,
      estimatedConsultationStart,
      recommendedArrivalTime,
      tokenNumber: patientToken,
      patientsAhead: activePatientsAhead,
      confidence,
      confidenceLevel,
      estimatedWindowStart: startWindowDate,
      estimatedWindowEnd: endWindowDate,
      recommendedArrivalDate: arrivalDate,
    };
  }
}

/**
 * QueuePredictionEngine
 * 
 * Central facade dispatching prediction requests to the active provider.
 * Supports future plug-in of MLQueuePredictionProvider when real clinic telemetry is available.
 */
export class QueuePredictionEngine {
  private static activeProvider: QueuePredictionProvider = new DeterministicQueuePredictionProvider();

  public static setProvider(provider: QueuePredictionProvider) {
    this.activeProvider = provider;
  }

  public static predict(input: QueuePredictionInput): QueuePredictionOutput {
    return this.activeProvider.predictWaitTime(input);
  }
}
