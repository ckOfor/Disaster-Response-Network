import { describe, it, expect, beforeEach } from 'vitest';

// Mock blockchain state
interface BlockchainState {
  disasters: Map<number, Disaster>;
  responseTeams: Map<string, ResponseTeam>;
  aidProposals: Map<number, AidProposal>;
  currentBlock: number;
  balances: Map<string, number>;
}

interface Disaster {
  name: string;
  location: string;
  fundsRequired: number;
  fundsRaised: number;
  active: boolean;
}

interface ResponseTeam {
  name: string;
  reputation: number;
}

interface AidProposal {
  disasterId: number;
  teamId: string;
  amount: number;
  votes: number;
  executed: boolean;
}

describe('Disaster Response Network Smart Contract', () => {
  let state: BlockchainState;
  const wallet1 = 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const wallet2 = 'ST2PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const wallet3 = 'ST3PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM';
  const contractAddress = 'STFCKHQNPQH8QKVY5BXRNXC0N7XDVS9AQVVQ6FXJ';
  
  beforeEach(() => {
    // Reset blockchain state before each test
    state = {
      disasters: new Map(),
      responseTeams: new Map(),
      aidProposals: new Map(),
      currentBlock: 1,
      balances: new Map([
        [wallet1, 1000000], // Increase initial balance
        [wallet2, 1000000], // Increase initial balance
        [wallet3, 1000000], // Increase initial balance
        [contractAddress, 0]
      ])
    };
  });
  
  // Mock contract functions
  const registerDisaster = (name: string, location: string, fundsRequired: number): number => {
    const disasterId = state.disasters.size + 1;
    const disaster: Disaster = {
      name,
      location,
      fundsRequired,
      fundsRaised: 0,
      active: true
    };
    state.disasters.set(disasterId, disaster);
    return disasterId;
  };
  
  const donateToDisaster = (sender: string, disasterId: number, amount: number): boolean => {
    const disaster = state.disasters.get(disasterId);
    if (!disaster || !disaster.active) {
      throw new Error('Disaster not found or inactive');
    }
    const balance = state.balances.get(sender) || 0;
    if (balance < amount) {
      throw new Error('Insufficient balance');
    }
    state.balances.set(sender, balance - amount);
    state.balances.set(contractAddress, (state.balances.get(contractAddress) || 0) + amount);
    disaster.fundsRaised += amount;
    state.disasters.set(disasterId, disaster);
    return true;
  };
  
  const registerResponseTeam = (sender: string, name: string): boolean => {
    const team: ResponseTeam = {
      name,
      reputation: 0
    };
    state.responseTeams.set(sender, team);
    return true;
  };
  
  const createAidProposal = (sender: string, disasterId: number, amount: number): number => {
    const disaster = state.disasters.get(disasterId);
    const team = state.responseTeams.get(sender);
    if (!disaster || !disaster.active || !team) {
      throw new Error('Invalid disaster or unauthorized team');
    }
    if (amount > disaster.fundsRequired - disaster.fundsRaised) {
      throw new Error('Insufficient funds available');
    }
    const proposalId = state.aidProposals.size + 1;
    const proposal: AidProposal = {
      disasterId,
      teamId: sender,
      amount,
      votes: 0,
      executed: false
    };
    state.aidProposals.set(proposalId, proposal);
    return proposalId;
  };
  
  const voteOnProposal = (proposalId: number): boolean => {
    const proposal = state.aidProposals.get(proposalId);
    if (!proposal || proposal.executed) {
      throw new Error('Invalid or executed proposal');
    }
    proposal.votes += 1;
    state.aidProposals.set(proposalId, proposal);
    return true;
  };
  
  const executeProposal = (proposalId: number): boolean => {
    const proposal = state.aidProposals.get(proposalId);
    if (!proposal || proposal.executed || proposal.votes < 3) {
      throw new Error('Invalid proposal or insufficient votes');
    }
    const disaster = state.disasters.get(proposal.disasterId);
    const team = state.responseTeams.get(proposal.teamId);
    if (!disaster || !disaster.active || !team) {
      throw new Error('Invalid disaster or team');
    }
    disaster.fundsRaised -= proposal.amount;
    team.reputation += 1;
    proposal.executed = true;
    state.disasters.set(proposal.disasterId, disaster);
    state.responseTeams.set(proposal.teamId, team);
    state.aidProposals.set(proposalId, proposal);
    state.balances.set(contractAddress, (state.balances.get(contractAddress) || 0) - proposal.amount);
    state.balances.set(proposal.teamId, (state.balances.get(proposal.teamId) || 0) + proposal.amount);
    return true;
  };
  
  // Tests
  it('allows registering a new disaster', () => {
    const disasterId = registerDisaster('Earthquake', 'City A', 10000);
    const disaster = state.disasters.get(disasterId);
    
    expect(disasterId).toBe(1);
    expect(disaster).toBeDefined();
    expect(disaster?.name).toBe('Earthquake');
    expect(disaster?.location).toBe('City A');
    expect(disaster?.fundsRequired).toBe(10000);
  });
  
  it('allows donating to a disaster', () => {
    const disasterId = registerDisaster('Flood', 'City B', 20000);
    const result = donateToDisaster(wallet1, disasterId, 5000);
    
    expect(result).toBe(true);
    expect(state.disasters.get(disasterId)?.fundsRaised).toBe(5000);
    expect(state.balances.get(wallet1)).toBe(995000);
    expect(state.balances.get(contractAddress)).toBe(5000);
  });
  
  it('allows registering a response team', () => {
    const result = registerResponseTeam(wallet2, 'Rescue Team Alpha');
    
    expect(result).toBe(true);
    expect(state.responseTeams.get(wallet2)).toBeDefined();
    expect(state.responseTeams.get(wallet2)?.name).toBe('Rescue Team Alpha');
  });
  
  it('allows creating an aid proposal', () => {
    const disasterId = registerDisaster('Hurricane', 'City C', 30000);
    donateToDisaster(wallet1, disasterId, 20000);
    registerResponseTeam(wallet2, 'Rescue Team Beta');
    const proposalId = createAidProposal(wallet2, disasterId, 10000);
    
    expect(proposalId).toBe(1);
    expect(state.aidProposals.get(proposalId)).toBeDefined();
    expect(state.aidProposals.get(proposalId)?.amount).toBe(10000);
  });
  
  it('prevents creating a proposal for more funds than available', () => {
    const disasterId = registerDisaster('Tsunami', 'City E', 100000);
    donateToDisaster(wallet1, disasterId, 50000);
    registerResponseTeam(wallet3, 'Rescue Team Delta');
    
    expect(() => createAidProposal(wallet3, disasterId, 60000)).toThrow('Insufficient funds available');
  });
});

