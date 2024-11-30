;; Disaster Response Network Smart Contract

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-not-found (err u100))
(define-constant err-unauthorized (err u101))
(define-constant err-insufficient-funds (err u102))

;; Data Variables
(define-data-var last-disaster-id uint u0)
(define-data-var last-proposal-id uint u0)

;; Define the structure of a disaster
(define-map disasters
  { disaster-id: uint }
  {
    name: (string-ascii 64),
    location: (string-ascii 64),
    funds-required: uint,
    funds-raised: uint,
    active: bool
  }
)

;; Define the structure of a response team
(define-map response-teams
  { team-id: principal }
  {
    name: (string-ascii 64),
    reputation: uint
  }
)

;; Define the structure of an aid proposal
(define-map aid-proposals
  { proposal-id: uint }
  {
    disaster-id: uint,
    team-id: principal,
    amount: uint,
    votes: uint,
    executed: bool
  }
)

;; Register a new disaster
(define-public (register-disaster (name (string-ascii 64)) (location (string-ascii 64)) (funds-required uint))
  (let
    (
      (disaster-id (+ (var-get last-disaster-id) u1))
    )
    (map-set disasters
      { disaster-id: disaster-id }
      {
        name: name,
        location: location,
        funds-required: funds-required,
        funds-raised: u0,
        active: true
      }
    )
    (var-set last-disaster-id disaster-id)
    (ok disaster-id)
  )
)

;; Donate funds to a disaster
(define-public (donate-to-disaster (disaster-id uint) (amount uint))
  (let
    (
      (disaster (unwrap! (map-get? disasters { disaster-id: disaster-id }) err-not-found))
    )
    (asserts! (get active disaster) err-unauthorized)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (ok (map-set disasters
      { disaster-id: disaster-id }
      (merge disaster { funds-raised: (+ (get funds-raised disaster) amount) })))
  )
)

;; Register a new response team
(define-public (register-response-team (name (string-ascii 64)))
  (ok (map-set response-teams
    { team-id: tx-sender }
    {
      name: name,
      reputation: u0
    }))
)

;; Create an aid proposal
(define-public (create-aid-proposal (disaster-id uint) (amount uint))
  (let
    (
      (proposal-id (+ (var-get last-proposal-id) u1))
      (disaster (unwrap! (map-get? disasters { disaster-id: disaster-id }) err-not-found))
      (team (unwrap! (map-get? response-teams { team-id: tx-sender }) err-unauthorized))
    )
    (asserts! (get active disaster) err-unauthorized)
    (asserts! (<= amount (- (get funds-required disaster) (get funds-raised disaster))) err-insufficient-funds)
    (map-set aid-proposals
      { proposal-id: proposal-id }
      {
        disaster-id: disaster-id,
        team-id: tx-sender,
        amount: amount,
        votes: u0,
        executed: false
      }
    )
    (var-set last-proposal-id proposal-id)
    (ok proposal-id)
  )
)

;; Vote on an aid proposal
(define-public (vote-on-proposal (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? aid-proposals { proposal-id: proposal-id }) err-not-found))
      (disaster (unwrap! (map-get? disasters { disaster-id: (get disaster-id proposal) }) err-not-found))
    )
    (asserts! (not (get executed proposal)) err-unauthorized)
    (asserts! (get active disaster) err-unauthorized)
    (ok (map-set aid-proposals
      { proposal-id: proposal-id }
      (merge proposal { votes: (+ (get votes proposal) u1) })))
  )
)

;; Execute an aid proposal
(define-public (execute-proposal (proposal-id uint))
  (let
    (
      (proposal (unwrap! (map-get? aid-proposals { proposal-id: proposal-id }) err-not-found))
      (disaster (unwrap! (map-get? disasters { disaster-id: (get disaster-id proposal) }) err-not-found))
      (team (unwrap! (map-get? response-teams { team-id: (get team-id proposal) }) err-not-found))
    )
    (asserts! (not (get executed proposal)) err-unauthorized)
    (asserts! (get active disaster) err-unauthorized)
    (asserts! (>= (get votes proposal) u3) err-unauthorized) ;; Require at least 3 votes
    (try! (as-contract (stx-transfer? (get amount proposal) tx-sender (get team-id proposal))))
    (map-set aid-proposals
      { proposal-id: proposal-id }
      (merge proposal { executed: true })
    )
    (map-set disasters
      { disaster-id: (get disaster-id proposal) }
      (merge disaster { funds-raised: (- (get funds-raised disaster) (get amount proposal)) })
    )
    (map-set response-teams
      { team-id: (get team-id proposal) }
      (merge team { reputation: (+ (get reputation team) u1) })
    )
    (ok true)
  )
)

;; Get disaster details
(define-read-only (get-disaster (disaster-id uint))
  (map-get? disasters { disaster-id: disaster-id })
)

;; Get response team details
(define-read-only (get-response-team (team-id principal))
  (map-get? response-teams { team-id: team-id })
)

;; Get aid proposal details
(define-read-only (get-aid-proposal (proposal-id uint))
  (map-get? aid-proposals { proposal-id: proposal-id })
)

