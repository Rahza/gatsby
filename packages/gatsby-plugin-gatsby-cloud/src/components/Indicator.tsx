import React, { FC, useState, useEffect, useCallback, useRef } from "react"
import { BuildStatus } from "../models/enums"
import getBuildInfo from "../utils/getBuildInfo"
import trackEvent from "../utils/trackEvent"
import {
  LinkIndicatorButton,
  InfoIndicatorButton,
  GatsbyIndicatorButton,
} from "./buttons"
import Style from "./Style"

interface IBuildInfo {
  currentBuild: any
  latestBuild: any
  siteInfo: any
  isOnPrettyUrl?: boolean
  buildStatus: BuildStatus
}

const POLLING_INTERVAL: number = process.env.GATSBY_PREVIEW_POLL_INTERVAL
  ? parseInt(process.env.GATSBY_PREVIEW_POLL_INTERVAL)
  : 3000

const PreviewIndicator: FC = ({ children }) => (
  <>
    <Style />
    <div
      data-testid="preview-status-indicator"
      data-gatsby-preview-indicator="root"
      aria-live="assertive"
    >
      {children}
    </div>
  </>
)

let buildId = ``

const Indicator: FC = () => {
  const [buildInfo, setBuildInfo] = useState<IBuildInfo>()

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const shouldPoll = useRef(false)
  const trackedInitialLoad = useRef(false)

  const { siteInfo, currentBuild } = buildInfo || {
    siteInfo: {},
    currentBuild: {},
  }

  const { orgId, siteId } = siteInfo || {}

  const pollData = useCallback(async function pollData() {
    const prettyUrlRegex = /^preview-/
    const host = window.location.hostname

    // currentBuild is the most recent build that is not QUEUED.
    // latestBuild is the most recent build that finished running (ONLY status ERROR or SUCCESS)
    const isOnPrettyUrl = prettyUrlRegex.test(host)
    const { siteInfo, currentBuild, latestBuild } = await getBuildInfo()

    if (!buildId) {
      if (isOnPrettyUrl || host === `localhost`) {
        buildId = latestBuild?.id
      } else {
        // Match UUID from preview build URL https://build-af44185e-b8e5-11eb-8529-0242ac130003.gtsb.io
        const buildIdMatch = host?.match(/build-(.*?(?=\.))/)
        if (buildIdMatch) {
          buildId = buildIdMatch[1]
        }
      }
    }

    const newBuildInfo = {
      currentBuild,
      latestBuild,
      siteInfo,
      isOnPrettyUrl,
    }

    if (currentBuild?.buildStatus === BuildStatus.BUILDING) {
      setBuildInfo({ ...newBuildInfo, buildStatus: BuildStatus.BUILDING })
    } else if (currentBuild?.buildStatus === BuildStatus.ERROR) {
      setBuildInfo({ ...newBuildInfo, buildStatus: BuildStatus.ERROR })
    } else if (buildId && buildId === newBuildInfo?.currentBuild?.id) {
      setBuildInfo({ ...newBuildInfo, buildStatus: BuildStatus.UPTODATE })
    } else if (
      buildId &&
      buildId !== newBuildInfo?.latestBuild?.id &&
      currentBuild?.buildStatus === BuildStatus.SUCCESS
    ) {
      setBuildInfo({ ...newBuildInfo, buildStatus: BuildStatus.SUCCESS })
    }

    if (shouldPoll.current) {
      timeoutRef.current = setTimeout(pollData, POLLING_INTERVAL)
    }
  }, [])

  useEffect(() => {
    if (buildInfo?.siteInfo && !trackedInitialLoad.current) {
      trackEvent({
        eventType: `PREVIEW_INDICATOR_LOADED`,
        buildId,
        orgId,
        siteId,
      })

      trackedInitialLoad.current = true
    }
  }, [buildInfo])

  useEffect(() => {
    shouldPoll.current = true
    pollData()

    return (): void => {
      shouldPoll.current = false

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  const buttonProps = {
    orgId,
    siteId,
    buildId,
    buildStatus: buildInfo?.buildStatus,
    isOnPrettyUrl: buildInfo?.isOnPrettyUrl,
    sitePrefix: siteInfo?.sitePrefix,
    createdAt: currentBuild?.createdAt,
    erroredBuildId: currentBuild?.id,
  }

  return (
    <PreviewIndicator>
      <GatsbyIndicatorButton buttonIndex={1} {...buttonProps} />
      <LinkIndicatorButton buttonIndex={2} {...buttonProps} />
      <InfoIndicatorButton buttonIndex={3} {...buttonProps} />
    </PreviewIndicator>
  )
}

export { PreviewIndicator }
export default Indicator