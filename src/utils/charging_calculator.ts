export interface ChargingCalibrationProfile {
  usableBatteryKWh: number;
  wallEnergyFullKWh: number;
  fullChargeHours: number;
  taperStartPercent: number;
}

export interface ChargingMetrics {
  powerInKw: number;
  actualPowerToBatteryKw: number;
  timeToChargeHours: number;
  totalCost: number;
  chargingEfficiency: number;
  persenRealtime: number;
}

export class ChargingCalculator {
  static calculateMetrics(params: {
    currentPowerConsumption: number; // in Watt
    batteryCapacity: number; // in kWh
    chargingEfficiency: number;
    electricityCostPerKWh: number;
    persenAwal: number;
    persenTarget: number;
    persenRealtime: number;
    isCharging: boolean;
    calibration?: ChargingCalibrationProfile | null;
  }): ChargingMetrics {
    const {
      currentPowerConsumption,
      batteryCapacity,
      chargingEfficiency,
      electricityCostPerKWh,
      persenAwal,
      persenTarget,
      persenRealtime,
      isCharging,
      calibration
    } = params;

    const powerInKw = currentPowerConsumption / 1000.0;
    const dynamicEfficiency = chargingEfficiency;

    const actualPowerToBatteryKw = isCharging ? powerInKw * dynamicEfficiency : 0.0;
    const currentPercent = persenRealtime;
    const deltaPersenTotal = Math.max(0.0, (persenTarget - persenAwal) / 100.0);

    const effectiveBatteryKWh = calibration?.usableBatteryKWh ?? batteryCapacity;
    const taperStartPercent = calibration?.taperStartPercent ?? 80.0;
    const calibratedWallEnergyFullKWh = calibration?.wallEnergyFullKWh;
    const calibratedFullChargeHours = calibration?.fullChargeHours;

    let timeToChargeHours = 0.0;

    if (isCharging && actualPowerToBatteryKw > 0) {
      if (
        calibration &&
        persenAwal === 0 &&
        persenRealtime === 0 &&
        persenTarget === 100 &&
        calibratedFullChargeHours
      ) {
        timeToChargeHours = calibratedFullChargeHours;
      } else {
        // Minimum power assumption to prevent infinite time
        const powerForEstimate = Math.max(actualPowerToBatteryKw, 0.5 * dynamicEfficiency);

        // Time for CC phase (below taper start)
        if (currentPercent < taperStartPercent) {
          const ccEndPercent = Math.min(persenTarget, taperStartPercent);
          const ccDelta = Math.max(0.0, (ccEndPercent - currentPercent) / 100.0);
          const ccEnergyKwh = effectiveBatteryKWh * ccDelta;
          timeToChargeHours += ccEnergyKwh / powerForEstimate;
        }

        // Time for CV phase (SLA taper) using numerical integration
        if (persenTarget > taperStartPercent) {
          const cvStartPercent = Math.max(taperStartPercent, currentPercent);
          if (cvStartPercent < persenTarget) {
            const steps = Math.ceil(persenTarget - cvStartPercent);
            let cvTime = 0.0;

            for (let i = 0; i < steps; i++) {
              const stepSoC = cvStartPercent + i;
              const normalizedCVSoC = (stepSoC - taperStartPercent) / (100.0 - taperStartPercent);
              const powerFactor = 1.0 - (0.9 * normalizedCVSoC);

              const stepPower = Math.max(powerForEstimate * powerFactor, 0.1 * dynamicEfficiency);
              const stepEnergyKwh = effectiveBatteryKWh * (1.0 / 100.0);

              cvTime += stepEnergyKwh / stepPower;
            }
            timeToChargeHours += cvTime;
          }
        }
      }
    }

    const totalEnergiAc0100Kwh = calibratedWallEnergyFullKWh ?? (batteryCapacity / dynamicEfficiency);
    const totalCost = totalEnergiAc0100Kwh * deltaPersenTotal * electricityCostPerKWh;

    return {
      powerInKw,
      actualPowerToBatteryKw,
      timeToChargeHours,
      totalCost,
      chargingEfficiency: dynamicEfficiency,
      persenRealtime
    };
  }
}