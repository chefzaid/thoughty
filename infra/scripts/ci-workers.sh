#!/bin/sh
# Prints how many workers a CI job can start without oversubscribing its CPUs.
#
# Jest, Vitest, ESLint and Playwright size their pools from the CPUs the
# operating system reports, which inside a CI pod are the node's threads, not
# the job's CPU limit. The count here comes from the container's CFS quota.
#
#   cpus     the job's CPUs (rounded up)
#   test     CPUs minus one, at least one: Jest, Vitest and ESLint threads,
#            leaving one CPU to the main process (the runners' own rule)
#   browser  half the CPUs, at least one: each Playwright worker drives a
#            Chromium, and the Vite dev server runs in the same job
set -eu

job_cpus() {
  if [ -r /sys/fs/cgroup/cpu.max ]; then
    read -r quota period < /sys/fs/cgroup/cpu.max
    if [ "$quota" != max ]; then
      echo $(((quota + period - 1) / period))
      return
    fi
  elif [ -r /sys/fs/cgroup/cpu/cpu.cfs_quota_us ] && [ -r /sys/fs/cgroup/cpu/cpu.cfs_period_us ]; then
    quota="$(cat /sys/fs/cgroup/cpu/cpu.cfs_quota_us)"
    period="$(cat /sys/fs/cgroup/cpu/cpu.cfs_period_us)"
    if [ "$quota" -gt 0 ]; then
      echo $(((quota + period - 1) / period))
      return
    fi
  fi
  nproc 2>/dev/null || getconf _NPROCESSORS_ONLN
}

cpus="$(job_cpus)"
case "${1:-cpus}" in
  cpus) workers="$cpus" ;;
  test) workers=$((cpus - 1)) ;;
  browser) workers=$((cpus / 2)) ;;
  *)
    printf 'Usage: %s [cpus|test|browser]\n' "$0" >&2
    exit 2
    ;;
esac
[ "$workers" -ge 1 ] || workers=1
echo "$workers"
